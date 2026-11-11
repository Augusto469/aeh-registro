/**
 * Dibuja el PDF a partir de los datos ya armados por `domain/informe.ts`.
 * Este módulo se carga recién al generar el informe (import dinámico), así
 * jsPDF no pesa en el arranque de la app.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { nombreMes } from '../../domain/fechas';
import type { DatosInforme } from '../../domain/informe';

export interface FotoInforme {
  dataUrl: string;
  ancho: number;
  alto: number;
}

export interface OpcionesPdf {
  incluirNotas: boolean;
  /** Fotos por id de crisis; vacío si no se incluyen */
  fotos: Record<string, FotoInforme[]>;
}

const VERDE: [number, number, number] = [15, 118, 110];
const MARGEN = 14;

export function generarPdf(d: DatosInforme, op: OpcionesPdf): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = () => doc.internal.pageSize.getWidth();
  const alto = () => doc.internal.pageSize.getHeight();
  const finTabla = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let y = 18;

  const asegurar = (necesario: number) => {
    if (y + necesario > alto() - 16) {
      doc.addPage();
      y = 18;
    }
  };
  const titulo = (texto: string) => {
    asegurar(20);
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...VERDE);
    doc.text(texto, MARGEN, y);
    doc.setTextColor(0);
    y += 3;
  };
  const tabla = (head: string[], body: (string | number)[][], extra: object = {}) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: MARGEN, right: MARGEN },
      styles: { fontSize: 9, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: VERDE },
      ...extra,
    });
    y = finTabla() + 9;
  };

  // ----- Encabezado -----
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text('Informe de crisis de angioedema hereditario', MARGEN, y);
  y += 7;
  doc.setFont('helvetica', 'normal').setFontSize(10);
  const p = d.paciente;
  const lineas = [
    p.nombre && `Paciente: ${p.nombre}`,
    p.documento && `Documento: ${p.documento}`,
    p.fechaNacimiento && `Fecha de nacimiento: ${p.fechaNacimiento.split('-').reverse().join('/')}`,
    p.diagnostico && `Diagnóstico: ${p.diagnostico}`,
    p.profilaxis && `Profilaxis actual: ${p.profilaxis}`,
    p.medico && `Médico tratante: ${p.medico}`,
    `Período: ${d.periodoTexto}`,
    `Generado: ${d.generadoEn}`,
  ].filter(Boolean) as string[];
  for (const l of lineas) {
    doc.text(doc.splitTextToSize(l, ancho() - 2 * MARGEN), MARGEN, y);
    y += 5;
  }
  doc.setFontSize(8).setTextColor(90);
  doc.text('Datos registrados por el propio paciente en su celular. No constituyen una historia clínica.', MARGEN, y);
  doc.setTextColor(0);
  y += 9;

  // ----- Resumen -----
  titulo('Resumen del período');
  tabla(['Indicador', 'Valor'], d.resumen.map((f) => [f.etiqueta, f.valor]), { columnStyles: { 0: { cellWidth: 90 } } });

  if (d.avisos.length) {
    doc.setFont('helvetica', 'italic').setFontSize(9);
    for (const a of d.avisos) {
      const partes = doc.splitTextToSize(`Nota: ${a}`, ancho() - 2 * MARGEN);
      asegurar(partes.length * 4 + 2);
      doc.text(partes, MARGEN, y);
      y += partes.length * 4 + 1;
    }
    y += 5;
  }

  // ----- Crisis por mes (barras) -----
  if (d.porMes.length && d.detalle.length) {
    titulo('Crisis por mes');
    asegurar(48);
    const max = Math.max(1, ...d.porMes.map((m) => m.cantidad));
    const paso = (ancho() - 2 * MARGEN) / d.porMes.length;
    const base = y + 34;
    const salto = Math.ceil(d.porMes.length / 12);
    doc.setFont('helvetica', 'normal').setFontSize(7);
    d.porMes.forEach((m, i) => {
      const x = MARGEN + i * paso;
      const h = (m.cantidad / max) * 26;
      doc.setFillColor(...VERDE);
      if (m.cantidad) {
        doc.rect(x + paso * 0.15, base - h, paso * 0.7, h, 'F');
        doc.text(String(m.cantidad), x + paso / 2, base - h - 1.5, { align: 'center' });
      }
      if (i % salto === 0) doc.text(nombreMes(m.mes), x + paso / 2, base + 4, { align: 'center' });
    });
    doc.setDrawColor(150).line(MARGEN, base, ancho() - MARGEN, base);
    y = base + 13;
  }

  // ----- Frecuencias -----
  const conteo = (nombre: string, datos: { etiqueta: string; cantidad: number }[]) => {
    if (!datos.length) return;
    titulo(nombre);
    tabla(['', 'Crisis'], datos.map((x) => [x.etiqueta, x.cantidad]), { columnStyles: { 0: { cellWidth: 90 } } });
  };
  conteo('Zonas afectadas', d.zonas);
  conteo('Desencadenantes sospechados', d.desencadenantes);
  conteo('Síntomas previos (pródromos)', d.prodromos);

  if (d.medicacion.length) {
    titulo('Medicación de rescate');
    tabla(
      ['Medicamento', 'Dosis', 'Crisis', 'Funcionó', 'Parcial', 'No funcionó', 'Sin dato'],
      d.medicacion.map((m) => [m.medicamento, m.usos, m.crisis, m.funciono, m.parcial, m.noFunciono, m.sinDato]),
    );
  }

  // ----- Detalle, en hoja apaisada para que entren las columnas -----
  if (d.detalle.length) {
    doc.addPage('a4', 'landscape');
    y = 16;
    titulo('Detalle de cada crisis');
    const columnas = ['N.º', 'Inicio', 'Fin', 'Duración', 'Zonas', 'Gravedad', 'Síntomas previos', 'Desencadenantes', 'Medicación de rescate', 'Atención', 'Días perdidos'];
    if (op.incluirNotas) columnas.push('Notas');
    tabla(
      columnas,
      d.detalle.map((f) => {
        const fila = [f.numero, f.inicio, f.fin, f.duracion, f.zonas, f.gravedad, f.prodromos, f.desencadenantes, f.medicacion, f.atencion, f.diasPerdidos];
        if (op.incluirNotas) fila.push(f.notas);
        return fila;
      }),
      {
        styles: { fontSize: 7.5, cellPadding: 1.2, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 8 }, 8: { cellWidth: op.incluirNotas ? 48 : 62 } },
        // Las crisis con lengua o laringe se resaltan: es lo primero que busca el médico.
        didParseCell: (celda: { section: string; row: { index: number }; column: { index: number }; cell: { styles: { textColor: unknown; fontStyle: string } } }) => {
          if (celda.section === 'body' && celda.column.index === 4 && d.detalle[celda.row.index]?.viaAerea) {
            celda.cell.styles.textColor = [185, 28, 28];
            celda.cell.styles.fontStyle = 'bold';
          }
        },
      },
    );
  }

  // ----- Fotos -----
  const conFotos = d.detalle.filter((f) => op.fotos[f.id]?.length);
  if (conFotos.length) {
    doc.addPage('a4', 'portrait');
    y = 18;
    titulo('Fotos');
    y += 3;
    const anchoFoto = (ancho() - 2 * MARGEN - 6) / 2;
    for (const f of conFotos) {
      asegurar(30);
      doc.setFont('helvetica', 'bold').setFontSize(10);
      doc.text(`Crisis N.º ${f.numero} - ${f.inicio} - ${f.zonas}`, MARGEN, y);
      y += 4;
      let col = 0;
      let altoFila = 0;
      for (const foto of op.fotos[f.id]) {
        const h = Math.min(110, (anchoFoto * foto.alto) / foto.ancho);
        const w = (h * foto.ancho) / foto.alto;
        if (col === 0 && y + h > alto() - 16) {
          doc.addPage();
          y = 18;
        }
        doc.addImage(foto.dataUrl, 'JPEG', MARGEN + col * (anchoFoto + 6), y, w, h);
        altoFila = Math.max(altoFila, h);
        col++;
        if (col === 2) {
          col = 0;
          y += altoFila + 5;
          altoFila = 0;
        }
      }
      if (col !== 0) y += altoFila + 5;
      y += 4;
    }
  }

  // ----- Pie con número de página -----
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120);
    doc.text(`Página ${i} de ${paginas}`, ancho() - MARGEN, alto() - 8, { align: 'right' });
    if (p.nombre) doc.text(p.nombre, MARGEN, alto() - 8);
  }
  return doc.output('blob');
}
