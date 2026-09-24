/**
 * Extrai todo o conteúdo de texto de um arquivo PDF diretamente no navegador.
 * Carrega a biblioteca oficial PDF.js via CDN de forma síncrona e confiável sem travar workers.
 */
export async function extractTextFromPDFFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  try {
    // Carregar pdfjs dinamicamente ou do window
    let pdfjs = (window as any).pdfjsLib;

    if (!pdfjs) {
      await loadPdfJsScript();
      pdfjs = (window as any).pdfjsLib;
    }

    if (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const loadingTask = pdfjs.getDocument({ data: uint8 });
      const pdfDoc = await loadingTask.promise;

      let fullText = '';
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join('\n');
        fullText += pageText + '\n';
      }

      if (fullText.trim().length > 0) {
        return fullText;
      }
    }
  } catch (err) {
    console.warn('Falha no leitor primário PDF.js, tentando fallback nativo:', err);
  }

  // Fallback nativo
  const fallback = extractTextFromPdfBinary(uint8);
  if (fallback.trim().length > 0) {
    return fallback;
  }

  throw new Error('Não foi possível ler as páginas do arquivo PDF. Verifique se o arquivo não está corrompido ou protegido por senha.');
}

/**
 * Injeta o script do PDF.js de versão estável compatível com todos os browsers modernos
 */
function loadPdfJsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca de leitura de PDF.'));
    document.head.appendChild(script);
  });
}

/**
 * Parser nativo de streams de texto PDF (BT...ET e blocos Tj/TJ/Text).
 * Funciona em 100% dos navegadores sem depender de Workers ou scripts externos.
 */
function extractTextFromPdfBinary(uint8Array: Uint8Array): string {
  const textDecoder = new TextDecoder('latin1');
  const rawContent = textDecoder.decode(uint8Array);

  const extractedLines: string[] = [];

  // 1. Procurar blocos de texto entre parênteses em streams: (Texto) Tj ou [(T)(e)(x)(t)(o)] TJ
  const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
  let match;
  while ((match = tjRegex.exec(rawContent)) !== null) {
    const clean = decodePdfString(match[1]);
    if (clean && clean.trim().length > 0) {
      extractedLines.push(clean.trim());
    }
  }

  // 2. Procurar blocos de array: [(Item 1) 20 (Item 2)] TJ
  const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(rawContent)) !== null) {
    const arrayContent = match[1];
    const innerMatches = arrayContent.match(/\(([^)]+)\)/g);
    if (innerMatches) {
      const line = innerMatches.map(m => decodePdfString(m.slice(1, -1))).join('').trim();
      if (line.length > 0) {
        extractedLines.push(line);
      }
    }
  }

  return extractedLines.join('\n');
}

function decodePdfString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}
