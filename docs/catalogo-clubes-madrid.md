# Catálogo de rivales

Importado el 31/10/2026 desde `clubes_baloncesto_madrid_catalogo.xlsx`: 89 clubes/entidades. La hoja de notas especifica que es una selección no exhaustiva, no una lista de plantillas o categorías.

El catálogo de referencia se distribuye con cada aplicación para que su consulta no consuma transferencia de Firebase. Al programar un partido, el nombre canónico del rival se guarda en el campo `opponent` de Firebase; los escudos se resuelven por ese nombre. Los nombres antiguos o rivales manuales se conservan. No se han renombrado ni reemplazado rivales históricos de ejemplo.

Datos: `src/data/madrid-clubs.json` y `front-cdir/data/madrid-clubs.json`. Ambos frontales incluyen sus propios PNG en `public/opponents`, de modo que sus despliegues son independientes. Los escudos se han convertido a PNG de hasta 160 px a partir de los enlaces del Excel. Se conservan proveedor, enlaces originales, fuente documental y temporada de referencia. Descargar una imagen no verifica que la correspondencia nombre/escudo del Excel sea correcta; las fuentes documentales del archivo pueden apuntar a entidades diferentes.

88 imágenes disponibles. El enlace de Movistar Estudiantes y las alternativas consultadas en su web oficial no respondieron; se muestra un icono de sustitución hasta disponer de una imagen válida. El selector permite rivales fuera del catálogo. No se debe confundir un club con un equipo A/B o una categoría concreta.
