import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'url:~assets/pdf.worker.min.js';

export interface ParsedMovement {
  movementName: string;
  englishName: string;
  category: string;
  targetMuscles: string;
}

/**
 * Extracts list of movements from a PDF file using client-side PDF.js.
 */
export async function extractMovementsFromPDF(arrayBuffer: ArrayBuffer): Promise<ParsedMovement[]> {
  // Sanitize and resolve the worker URL to a clean chrome-extension:// URL
  const cleanUrl = pdfWorkerUrl.split('?')[0];
  let finalWorkerSrc = cleanUrl;
  
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    if (!cleanUrl.startsWith('chrome-extension://')) {
      const relativePath = cleanUrl.startsWith('/') ? cleanUrl.slice(1) : cleanUrl;
      finalWorkerSrc = chrome.runtime.getURL(relativePath);
    }
  }
  
  console.log('PDF Parser: Setting workerSrc to:', finalWorkerSrc);
  pdfjsLib.GlobalWorkerOptions.workerSrc = finalWorkerSrc;

  console.log('PDF Parser: Loading PDF document from ArrayBuffer...');
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableFontFace: true,
  }).promise;
  
  const numPages = pdf.numPages;
  console.log(`PDF Parser: Document loaded successfully. Total pages: ${numPages}`);
  
  const movements: ParsedMovement[] = [];
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    console.log(`PDF Parser: Extracting text from page ${i}/${numPages}...`);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  console.log(`PDF Parser: Text extraction complete. Extracted ${fullText.length} characters.`);


  const lines = fullText.split('\n');
  let currentMovement: Partial<ParsedMovement> = {};

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Skip generic document page numbers and headers
    if (
      line.match(/^Page \d+$/i) ||
      line.toLowerCase().includes('compendium') ||
      line.toLowerCase().includes('index of movements')
    ) {
      continue;
    }

    // Try Key-Value Matching (e.g., "Movement Name: Swastikasana")
    const movementMatch = line.match(/(?:Movement Name|Movement|Pose|Name)\s*:\s*(.*)/i);
    const englishMatch = line.match(/(?:English Name|English|Translation)\s*:\s*(.*)/i);
    const categoryMatch = line.match(/(?:Category|Type)\s*:\s*(.*)/i);
    const musclesMatch = line.match(/(?:Target Muscles|Muscles|Target)\s*:\s*(.*)/i);

    if (movementMatch) {
      if (currentMovement.movementName) {
        movements.push(finalizeMovement(currentMovement));
      }
      currentMovement = { movementName: movementMatch[1].trim() };
      continue;
    }

    if (englishMatch && currentMovement.movementName) {
      currentMovement.englishName = englishMatch[1].trim();
      continue;
    }

    if (categoryMatch && currentMovement.movementName) {
      currentMovement.category = categoryMatch[1].trim();
      continue;
    }

    if (musclesMatch && currentMovement.movementName) {
      currentMovement.targetMuscles = musclesMatch[1].trim();
      continue;
    }

    // Pipe separated line (e.g. "Swastikasana | Auspicious Pose | Meditative | Target Muscles")
    const pipeParts = line.split('|');
    if (pipeParts.length >= 2) {
      if (currentMovement.movementName) {
        movements.push(finalizeMovement(currentMovement));
        currentMovement = {};
      }
      movements.push({
        movementName: pipeParts[0].trim(),
        englishName: pipeParts[1]?.trim() || '',
        category: pipeParts[2]?.trim() || '',
        targetMuscles: pipeParts[3]?.trim() || '',
      });
      continue;
    }

    // Tab separated line
    const tabParts = line.split('\t');
    if (tabParts.length >= 2) {
      if (currentMovement.movementName) {
        movements.push(finalizeMovement(currentMovement));
        currentMovement = {};
      }
      movements.push({
        movementName: tabParts[0].trim(),
        englishName: tabParts[1]?.trim() || '',
        category: tabParts[2]?.trim() || '',
        targetMuscles: tabParts[3]?.trim() || '',
      });
      continue;
    }

    // Fallback: If line contains a Sanskrit name or typical pose format, capture it
    const isYogaName = line.endsWith('asana') || line.endsWith('Asana') || line.includes('Pose');
    // Captures capitalized strings representing common exercise titles (e.g., Tadasana, Gomukhasana)
    const isStandardExercise = line.match(/^[A-Z][a-zA-Z\s\-]{3,35}$/);

    if (isYogaName || isStandardExercise) {
      if (currentMovement.movementName) {
        movements.push(finalizeMovement(currentMovement));
      }
      currentMovement = { movementName: line };
    }
  }

  // Push final item
  if (currentMovement.movementName) {
    movements.push(finalizeMovement(currentMovement));
  }

  console.log(`PDF Parser: Raw matched movements count: ${movements.length}`);
  if (movements.length > 0) {
    console.log('PDF Parser: Sample raw matches:', movements.slice(0, 5));
  }

  // Deduplicate and filter out small noise entries
  const seen = new Set<string>();
  const finalMovements = movements.filter((m) => {
    const key = m.movementName.toLowerCase();
    if (seen.has(key) || !m.movementName || m.movementName.length < 3) return false;
    seen.add(key);
    return true;
  });

  console.log(`PDF Parser: Final filtered/deduplicated movements count: ${finalMovements.length}`);
  if (finalMovements.length > 0) {
    console.log('PDF Parser: Sample final movements:', finalMovements.slice(0, 5));
  } else {
    console.warn('PDF Parser WARNING: Zero movements extracted! Check if the PDF content has text and matches the expected format (e.g. key-value, pipe, or tab separated).');
  }

  return finalMovements;
}

function finalizeMovement(part: Partial<ParsedMovement>): ParsedMovement {
  return {
    movementName: part.movementName || '',
    englishName: part.englishName || '',
    category: part.category || '',
    targetMuscles: part.targetMuscles || '',
  };
}

