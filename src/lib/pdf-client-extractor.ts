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
    text = await parseWithPdfJs(uint8.slice(), pdfWorkerUrl);
  } catch (err1) {
    console.warn('[PDF Extractor] Tentativa 1 (Worker Vite) falhou:', err1);
  }

  // Tentativa 2: pdfjs-dist desativando o worker (execução síncrona na thread principal)
  if (!text || text.trim().length === 0) {
    try {
      text = await parseWithPdfJs(uint8.slice(), false);
    } catch (err2) {
      console.warn('[PDF Extractor] Tentativa 2 (Sem Worker) falhou:', err2);
    }
  }

  // Tentativa 3: CDN unpkg como fallback
  if (!text || text.trim().length === 0) {
    try {
      const cdnWorker = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      text = await parseWithPdfJs(uint8.slice(), cdnWorker);
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
    console.error('[PDF Extractor] Falha no fallback de OCR:', ocrErr);
    const reason = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
    throw new Error(`OCR falhou durante a leitura do PDF: ${reason}`);
  }

  if (text && text.trim().length > 0) {
    return text;
  }

  throw new Error('OCR não retornou texto para este PDF.');
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
    data: new Uint8Array(uint8),
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
    data: new Uint8Array(uint8),
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  let recognizedText = '';

  // Carrega dinamicamente o Tesseract.js para não impactar o bundle inicial
  await assertOcrAssets(onProgress);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por', undefined, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core',
    langPath: '/tesseract/lang/',
    workerBlobURL: false,
    logger: (message: { status?: string; progress?: number }) => {
      if (message.status === 'recognizing text' && onProgress) {
        onProgress(`OCR: ${Math.round((message.progress || 0) * 100)}%`);
      }
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });

  if (onProgress) onProgress('OCR carregado. Reconhecendo texto...');

  try {
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      if (onProgress) {
        onProgress(`Lendo página ${pageNum} de ${pdfDoc.numPages} com OCR...`);
      }

      const page = await pdfDoc.getPage(pageNum);
      // Maior resolução melhora a leitura de códigos, quantidades e valores da tabela.
      const viewport = page.getViewport({ scale: 3.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) continue;

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < image.data.length; i += 4) {
        const gray = Math.round(
          image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114
        );
        const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
        image.data[i] = contrast;
        image.data[i + 1] = contrast;
        image.data[i + 2] = contrast;
      }
      ctx.putImageData(image, 0, 0);

      const tablePass = await worker.recognize(canvas, {}, { text: true });
      if (tablePass?.data?.text) {
        recognizedText += tablePass.data.text + '\n';
      }

      // A tabela costuma ser a região mais baixa e densa dos espelhos Medix.
      // OCR em um recorte aumenta a separação entre código, quantidade e preços.
      const tableCanvas = document.createElement('canvas');
      const tableTop = Math.floor(canvas.height * 0.38);
      tableCanvas.width = canvas.width;
      tableCanvas.height = canvas.height - tableTop;
      const tableContext = tableCanvas.getContext('2d', { willReadFrequently: true });
      if (tableContext) {
        tableContext.drawImage(
          canvas,
          0,
          tableTop,
          canvas.width,
          canvas.height - tableTop,
          0,
          0,
          tableCanvas.width,
          tableCanvas.height
        );

        await worker.setParameters({
          tessedit_pageseg_mode: '6',
          preserve_interword_spaces: '1',
        });
        const tableCropPass = await worker.recognize(tableCanvas, {}, { text: true });
        if (tableCropPass?.data?.text) {
          recognizedText += tableCropPass.data.text + '\n';
        }

        await worker.setParameters({ tessedit_pageseg_mode: '11' });
        const sparseCropPass = await worker.recognize(tableCanvas, {}, { text: true });
        if (sparseCropPass?.data?.text) {
          recognizedText += sparseCropPass.data.text + '\n';
        }
      }

      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      const sparsePass = await worker.recognize(canvas, {}, { text: true });
      if (sparsePass?.data?.text) {
        recognizedText += sparsePass.data.text + '\n';
      }
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      void sparsePass;
    }
  } finally {
    await worker.terminate();
  }

  return recognizedText;
}

async function assertOcrAssets(onProgress?: (msg: string) => void): Promise<void> {
  const assets = [
    '/tesseract/worker.min.js',
    '/tesseract/core/tesseract-core.wasm.js',
    '/tesseract/core/tesseract-core-lstm.wasm.js',
    '/tesseract/core/tesseract-core-simd.wasm.js',
    '/tesseract/core/tesseract-core-simd-lstm.wasm.js',
    '/tesseract/core/tesseract-core-relaxedsimd.wasm.js',
    '/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
    '/tesseract/lang/por.traineddata.gz',
  ];

  for (const asset of assets) {
    const response = await fetch(asset, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Asset OCR indisponível (${response.status}): ${asset}`);
    }
  }

  if (onProgress) onProgress('Assets locais do OCR verificados.');
}
