# Preparación física y psicología

Una cuenta mantiene su nivel de acceso (administrador o profesional). Las funciones deportivas se combinan: entrenador/a, preparación física y psicología. Las funciones se editan desde la ficha del profesional y también se eligen al autorizar su correo. No se cambia la identidad ni la foto al añadir una función.

- **Personas → Preparadores físicos / Psicología**: mismas tarjetas y ficha que los entrenadores, filtradas por función. Una persona aparece en varias secciones si combina funciones.
- **Equipos → Físico y psicología**: administración programa la sesión, profesional, temporada, sala e intervalo. Las sesiones físicas tienen participantes explícitos: habituales, invitados o recuperación. Los invitados no cambian de equipo habitual. Administración autoriza los participantes.
- **Preparador**: únicamente sesiones asignadas y sus jugadores; registra presente, ausente o justificada desde el comienzo de la sesión, y puede suspenderla. No puede subir resultados, solicitar subidas deportivas ni consultar familias o economía.
- **Psicología**: únicamente sus horarios; no se guardan pacientes, información clínica ni asistencia. El calendario muestra solo sus reservas.
- **Calendario**: reúne entrenamientos, partidos y sesiones de apoyo de las funciones autorizadas. Un entrenador que además sea preparador conserva ambos calendarios en la misma vista.

Firebase: migración aditiva 008, tablas staff_functions, support_sessions, support_participants, support_attendance. La migración y el esquema se desplegaron en cdir-apps / cdir-apps-2-service sin alterar registros existentes. El API verifica funciones y propietario de cada sesión en cada operación. Las pruebas de navegador usan datos locales aislados y no crean profesionales ni horarios ficticios en Firebase.

## Altas directas y calendario de administración
Las listas de Preparadores físicos y Psicología disponen de botones «Añadir preparador físico» y «Añadir psicólogo/a». Permiten una ficha nueva o añadir funciones a una existente; el correo existente se reutiliza y se conserva la fotografía. Crear ficha no da acceso a la plataforma; ese permiso se concede en Usuarios.

Administración → Calendario ofrece «Calendario del club» y «Mi calendario». La vista del club incluye toda la temporada seleccionada; la personal se deriva del correo de la ficha y de sus asignaciones, no del rol ADMIN. Se filtra por equipo, instalación/espacio, profesional, actividad, estado y búsqueda. Las semanas se calculan en Europe/Madrid y respetan los cambios de hora. La vista del club sigue siendo exclusiva de administración: el resto recibe únicamente los datos que permite el servidor.

Verificación del cambio de altas y calendario: 72 pruebas unitarias, TypeScript, compilación y navegación de escritorio/móvil correctas. El intento adicional de validación de escritura en Firebase se detuvo antes de escribir: SQL Connect devolvió HTTP 429 por Daily Free Data Egress Bytes. No se modificó la facturación y no se guardaron registros de prueba en la nube. El API muestra un mensaje específico para esta cuota.

## Calendario visual
El calendario abre en vista de mes, con una cuadrícula de lunes a domingo. La vista Semana coloca los eventos por hora y distribuye las coincidencias en columnas. Agenda conserva la lista detallada. Los eventos son seleccionables y abren una ficha con fecha, horario, instalación y profesional; los días con más de tres eventos permiten abrir la lista completa. Las vistas conservan filtros y alcance personal/club y se calculan con los datos ya cargados, sin peticiones adicionales a Firebase al navegar entre mes, semana y agenda. En móvil las cuadrículas tienen desplazamiento propio y la página mantiene su ancho.

## Instalaciones del club
Catálogo activo confirmado por administración: IES García Lorca, IES García Nieto, Colegio Europeo, Colegio Zola de Las Rozas e IES Carmen Conde. Los registros anteriores de demostración se archivan conservando sus IDs y referencias históricas. Las nuevas reservas solo admiten instalaciones activas. No se han inventado direcciones, pistas ni horarios físicos: los espacios figuran sin especificar hasta su confirmación.

## Hora física vinculada al entrenamiento
Regla confirmada: una hora de preparación física por equipo y semana, inmediatamente antes o después de uno de sus entrenamientos. En el formulario de sesiones físicas, al seleccionar equipo se ofrece el entrenamiento de referencia y la posición antes/después. Se utiliza su instalación; no se puede programar sobre un centro archivado. Se impide una segunda hora habitual del mismo equipo en la semana y se verifican profesional, jugadores y disponibilidad. Puede repetirse hasta 12 semanas, usando solo entrenamientos existentes de ese mismo día y hora local; si falta alguno, no se guarda ninguna sesión de la serie.

Pendiente de datos reales: correspondencia entre equipos y los cinco centros. Los entrenamientos importados de demostración siguen vinculados a instalaciones archivadas; no se ha inventado su ubicación ni creado sesiones físicas sobre esas referencias.
