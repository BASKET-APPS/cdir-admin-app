import {createCanvas} from '@napi-rs/canvas';
export async function renderMagazineCover(bytes:Buffer){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,disableFontFace:true,useWorkerFetch:false});
 const pdf=await task.promise;
 try{const page=await pdf.getPage(1),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(720/base.width,1100/base.height)}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvas:canvas as unknown as HTMLCanvasElement,viewport,background:'white'}).promise;return canvas.toBuffer('image/jpeg',86);}finally{await task.destroy();}
}
