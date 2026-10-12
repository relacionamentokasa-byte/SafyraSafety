import * as pdfjsLib from 'pdfjs-dist';
// Vite resolve o asset do worker localmente no bundle de produção sem depender de CDN externa
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

/**
 * Extrai todo o conteúdo de texto de um arquivo PDF no navegador.
 * 1. Tenta extração direta via PDF.js (camada de texto nativa).
 * 2. Se o PDF for vetorizado/curvado ou digitalizado (zero texto extraível, como pedidos da Medix gerados por Microsoft Print to PDF),
 *    renderiza as páginas em Canvas e executa OCR óptico (Tesseract.js) automaticamente.
 */
export async function extractTextFromPDFFile(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Tentativa 1: pdfjs-dist empacotado com worker local do Vite
  let text = '';
  try {
    text = await parseWithPdfJs(uint8, pdfWorkerUrl);
  } catch (err1) {
    console.warn('[PDF Extractor] Tentativa 1 (Worker Vite) falhou:', err1);
  }

  // Tentativa 2: pdfjs-dist desativando o worker (execução síncrona na thread principal)
  if (!text || text.trim().length === 0) {
    try {
      text = await parseWithPdfJs(uint8, false);
    } catch (err2) {
      console.warn('[PDF Extractor] Tentativa 2 (Sem Worker) falhou:', err2);
    }
  }

  // Tentativa 3: CDN unpkg como fallback
  if (!text || text.trim().length === 0) {
    try {
      const cdnWorker = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      text = await parseWithPdfJs(uint8, cdnWorker);
    } catch (err3) {
      console.warn('[PDF Extractor] Tentativa 3 (CDN Worker) falhou:', err3);
    }
  }

  // Se conseguiu extrair texto vetorial suficiente (> 20 caracteres), retorna diretamente
  if (text && text.trim().length > 20) {
    return text;
  }

  // Se o PDF não contém camada de texto selecionável (ex: Medix impresso via Microsoft Print to PDF com fontes em curvas/vetores)
  // Aciona OCR inteligente renderizando em Canvas no navegador
  try {
    if (onProgress) onProgress('PDF em curvas ou digitalizado detectado. Processando leitura óptica (OCR)...');
    const ocrText = await renderPdfAndRunOcr(uint8, onProgress);
    if (ocrText && ocrText.trim().length > 0) {
      return ocrText;
    }
  } catch (ocrErr) {
    console.warn('[PDF Extractor] Falha no fallback de OCR:', ocrErr);
  }

  if (text && text.trim().length > 0) {
    return text;
  }

  throw new Error('Não foi possível ler as páginas do arquivo PDF. O documento pode estar protegido ou ilegível.');
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

/**
 * Renderiza páginas do PDF em Canvas HTML5 e extrai o texto com OCR via Tesseract.js
 */
async function renderPdfAndRunOcr(
  uint8: Uint8Array,
  onProgress?: (msg: string) => void
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  let recognizedText = '';

  // Carrega dinamicamente o Tesseract.js para não impactar o bundle inicial
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por');

  try {
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      if (onProgress) {
        onProgress(`Lendo página ${pageNum} de ${pdfDoc.numPages} com OCR...`);
      }

      const page = await pdfDoc.getPage(pageNum);
      // Escala 2.0x para máxima nitidez de leitura de números, SKUs e tabelas
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) continue;

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const ret = await worker.recognize(canvas);
      if (ret?.data?.text) {
        recognizedText += ret.data.text + '\n';
      }
    }
  } finally {
    await worker.terminate();
  }

  return recognizedText;
}
