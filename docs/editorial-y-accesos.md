# Revistas, agenda pública y acceso deportivo

## Revistas
En Web pública → Revistas del club, «Nueva revista» abre un asistente: PDF (hasta 50 MB), título y descripción, y revisión de la portada real. Se guarda como borrador; publicar, retirar y eliminar borradores se gestionan en las tarjetas. Las revistas no dependen de una temporada.

## Agenda
Web pública agrupa Campus y eventos, Revistas y Vida del club. Las inscripciones y formularios tienen su propio grupo. La agenda pública `/front-cdir/eventos/` combina los eventos publicados y las actividades publicadas de vida del club. Cada registro publicado dispone de enlace directo. Los archivos antiguos quedan plegados bajo la agenda vigente. El feed muestra exclusivamente datos publicados.

## Entrenadores
En Usuarios se autoriza un correo y un rol. No se seleccionan equipos. La ficha deportiva se vincula al correo del usuario. Desde Equipos se asignan el primero y, opcionalmente, el segundo entrenador de cada temporada. El servidor calcula el acceso de las asignaciones actuales; ignora asignaciones FORMER y cualquier lista manual de equipos enviada al autorizar una cuenta. Un entrenador sin asignaciones puede acceder pero no obtiene acceso a equipos ajenos. Las asignaciones históricas se conservan y la interfaz filtra por la temporada seleccionada.

Validado: TypeScript de ambos proyectos, 57 pruebas unitarias, compilaciones de producción, consulta de asignaciones en SQL Connect real y pruebas de navegador de revistas, agenda y aislamiento de entrenadores. Los datos y guardados de las pruebas de interfaz se aíslan de Firebase.
