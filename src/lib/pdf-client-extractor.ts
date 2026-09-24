import * as pdfjsLib from 'pdfjs-dist';
// Vite resolve o asset do worker localmente no bundle de produção sem depender de CDN externa
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

/**
 * Extrai todo o conteúdo de texto de um arquivo PDF no navegador.
 * 1. Usa o worker local empacotado pelo Vite (pdfjs-dist).
 * 2. Se falhar, usa fake-worker interno do PDF.js (sem worker thread).
 * 3. Se falhar, tenta via CDN.
 */
export async function extractTextFromPDFFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Tentativa 1: pdfjs-dist empacotado com worker local do Vite
  try {
    const text = await parseWithPdfJs(uint8, pdfWorkerUrl);
    if (text && text.trim().length > 0) return text;
  } catch (err1) {
    console.warn('[PDF Extractor] Tentativa 1 (Worker Vite) falhou:', err1);
  }

  // Tentativa 2: pdfjs-dist desativando o worker (execução síncrona na thread principal)
  try {
    const text = await parseWithPdfJs(uint8, false);
    if (text && text.trim().length > 0) return text;
  } catch (err2) {
    console.warn('[PDF Extractor] Tentativa 2 (Sem Worker) falhou:', err2);
  }

  // Tentativa 3: CDN unpkg como fallback
  try {
    const cdnWorker = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const text = await parseWithPdfJs(uint8, cdnWorker);
    if (text && text.trim().length > 0) return text;
  } catch (err3) {
    console.warn('[PDF Extractor] Tentativa 3 (CDN Worker) falhou:', err3);
  }

  throw new Error('Não foi possível ler as páginas do arquivo PDF no navegador.');
}

async function parseWithPdfJs(uint8: Uint8Array, workerSrc: string | false): Promise<string> {
  if (typeof window !== 'undefined') {
    if (workerSrc === false) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    } else if (workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    }
  }

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    isEvalSupported: false,
    useSystemFonts: true,
  });

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

  return fullText;
}
