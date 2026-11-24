# Operaciones y datos del club

## Datos cargados en Firebase

Servicio cdir-apps-2-service, base cdir-apps-2-database. Tres temporadas: 2024/2025 y 2025/2026 cerradas; 2026/2027 abierta. Cada una contiene 8 equipos femeninos y 10 masculinos. Se han añadido 181 jugadores, 61 contactos familiares, 26 entrenadores, 1296 sesiones y 432 partidos de ejemplo. Hay ejemplos de cuotas, solicitudes pendientes/aprobadas, recuperaciones, bajas y notificaciones.

El sénior masculino usa los 11 nombres, dorsales, posiciones y fotos de la plantilla real de Basket Analytics (Firestore de cdir-basket-analytics), leído sin modificaciones. No se inventan sus fechas de nacimiento ni de alta: quedan pendientes. Las fotos se normalizan sin metadatos y se guardan como miniaturas WebP en SQL, visibles solo a usuarios autorizados. Los jugadores adultos son sus propios responsables. Las plantillas de temporadas anteriores son simulaciones de gestión, no registros históricos certificados. Los demás jugadores y entrenadores llevan la marca Ejemplo.

Los datos de inscripción y cuentas de ejemplo no acreditan consentimientos ni mandatos reales. Las ocho cuentas cifradas usan un IBAN de prueba; no se han realizado cargos. No utilizar esa exportación de ejemplo para emitir cobros.

## Navegación

- Personas: jugadores y sus tarjetas, familias con hijos vinculados, entrenadores con sus equipos.
- Equipos: plantilla y cuerpo técnico, calendario semanal, partidos/resultados, sesiones/pistas, solicitudes, histórico de subidas y asistencia.
- Web pública: contenidos, revistas PDF y vida del club. Fiestas y revistas no dependen del selector de temporada.
- Configuración: cuentas, notificaciones, bajas/privacidad y auditoría.

## Perfiles

La gestión permite autorizar Administrador del club o Entrenador por correo. Si ese correo aún no tiene usuario Firebase, se crea una autorización pendiente, sin enviar correo. En el primer acceso con Google verificado se vincula el UID. Los entrenadores requieren al menos un equipo. Las comprobaciones son de servidor: no ven familias, economía ni plantillas ajenas. El administrador puede retirar o restaurar acceso.

## Solicitudes y calendario

Una subida exige otra plantilla de la misma rama y temporada. Solo se permite subir de categoría/año o pasar de B a A dentro del mismo nivel. Las fechas de partidos y sesiones se evalúan respecto al momento actual. Las solicitudes de partido son puntuales; se muestran otros partidos de esa semana y se bloquea la coincidencia de horas. Si solo hay otro partido en diferente horario, el administrador debe revisar y justificar expresamente la autorización.

Los entrenamientos continuados incorporan al jugador en las sesiones futuras desde la autorización, incluidas las nuevas que se creen después. No modifican su equipo habitual. Los entrenadores pueden pasar asistencia, suspender entrenamientos y subir resultados de sus partidos al terminar. Babybasket y Escuelita no ofrecen marcador.

## Bajas y revisión semanal

La baja marca la fecha y desactiva las inscripciones de temporadas abiertas. Al entrar un administrador, se generan avisos semanales deduplicados. Revisado pospone el siguiente aviso siete días. Anonimizar ficha y contactos exige confirmación y no se presenta como borrado integral de toda la información relacionada.

Para ejecutar los avisos también sin visitas al panel, el host de producción debe programar semanalmente POST /api/jobs/retention con Authorization: Bearer RETENTION_JOB_SECRET. El endpoint está preparado, pero no hay un programador de producción conectado a este servidor local. No se envían correos ni notificaciones externas.

## Publicación y web pública

La web pública consume GET /api/public/club para partidos publicados, sus resultados, revistas publicadas y actividades del club. La landing y Revistas ya incluyen el componente y actualizan cada minuto. Los borradores nunca se incluyen; tampoco jugadores, familias o usuarios. Las cuatro revistas originales se han vinculado y los carteles reales de Azúa y Gandía se conservan en Contenidos como borradores de 2025/2026.

En desarrollo front-cdir apunta a http://127.0.0.1:3002. Para GitHub Pages debe definirse NEXT_PUBLIC_CDIR_API_URL con la URL HTTPS del servidor de administración desplegado. GitHub Pages por sí solo no ejecuta este backend. No se ha desplegado aún ese servidor ni cambiado el plan Spark.

## Pruebas y mantenimiento

npm test y npm run check validan dominio y tipos. scripts/club-ui-test.cjs y scripts/club-coach-test.cjs usan solo el servidor aislado 3003, CDIR_TEST_SERVER=true y el fichero .local/workspace-club-tests.json; nunca la base real. scripts/verify-club.mts revisa el recuento e integridad en Firebase sin cambiar personas. El seed usa identificadores estables y no sobrescribe datos existentes.

Para reproducir el seed: leer la plantilla de Basket Analytics con scripts/read-analytics-firestore.mjs, ejecutar db:seed:club y después scripts/seed-club-details.mts y scripts/publish-archive.mts. No aplicar las migraciones PostgreSQL locales directamente sobre SQL Connect. Revisar el diff COMPATIBLE antes de desplegar.

La página pública /calendario incorpora el filtro de equipo y aparece en el menú. Hay cuatro partidos y una actividad publicados exclusivamente como ejemplos identificados; el administrador puede retirarlos antes de usar datos reales. Se ha preparado .github/workflows/retention-reminders.yml para el disparo semanal; requiere desplegar el servidor y configurar CDIR_ADMIN_URL y RETENTION_JOB_SECRET.


## Fichas de personas y navegación (27 de octubre de 2026)

La administración mantiene su sesión y el estado de trabajo al cambiar de sección mediante el menú lateral. El esqueleto de carga se muestra al entrar; no se vuelve a descargar todo el club por cada pestaña. Los datos privados permanecen en memoria y se eliminan al cerrar sesión.

Familias agrupa los responsables vinculados a los mismos hijos de la temporada. El título toma los apellidos del jugador y separa a los adultos que son responsables de sí mismos. Las tarjetas muestran contacto e hijos clicables. Se puede registrar primero un responsable sin hijos y seleccionarlo después en el alta de jugador, o añadir vínculos desde su ficha familiar. Los vínculos existentes no se borran desde este formulario. La sección bancaria muestra titular, últimos cuatro dígitos y mandato solo a perfiles con permiso financiero; permite guardar una cuenta cifrada por inscripción de temporada.

Los permisos de aplicación (administrador o entrenador) son independientes del perfil deportivo. Una cuenta autorizada puede conservar el rol ADMIN y disponer de ficha de entrenador. Se vinculan por correo electrónico; no se inventan equipos ni titulaciones. La cuenta administradora del proyecto se ha vinculado al jugador real Juan Carlos y a su ficha de entrenador, conservando sus permisos.

La foto elegida en Mi perfil aparece también en la ficha de entrenador. Google se valida contra los dominios del proveedor. Las fotos propias se normalizan a WebP de 320 × 320, sin metadatos. En SQL Connect se almacenan dentro del perfil privado en la base de datos, sin depender de un bucket de Storage. La API no entrega su representación base64 en el estado público de la aplicación: sirve los bytes tras comprobar sesión, propietario o acceso al entrenador y versión de la imagen. Se puede cambiar a iniciales o borrar la foto subida.


## Revistas grandes (30 de octubre de 2026)

La migración 006 fue autorizada expresamente y aplicada con comprobación de tablas PDF vacías. Se mantienen las claves primarias, la relación con revistas, el índice único por subida/orden, el conector privado y `schemaValidation: COMPATIBLE`. Las validaciones de tamaño y bloques se realizan en el servidor.

Se admiten PDF de hasta 50 MB. Los archivos grandes se guardan en bloques de 1 MiB; cada solicitud a SQL Connect incluye como máximo dos bloques. Solo al terminar se inserta atómicamente la revista, su manifiesto y la auditoría; una subida incompleta nunca aparece como publicación. La lectura valida orden, tamaño y SHA-256 antes de servir el PDF. Las revistas previas conservan la lectura de su formato original. La nueva revista se guarda como borrador y requiere pulsar Publicar para mostrarse en la web pública.

Los SQL 005 y 006 son migraciones históricas, no deben repetirse sobre una base con archivos subidos. El script de completar la migración se detiene si encuentra documentos. El generador de esquema aplica todos los SQL sobre una base vacía de verificación y conserva el tipo de almacenamiento por bloques fuera del estado administrativo, para no cargar los PDF al navegar.


## Biblioteca visual y borrado de revistas

Las dos aplicaciones usan la misma tarjeta y el mismo lector PDF.js. La portada es una imagen JPEG renderizada desde la primera página, almacenada en la tabla técnica `magazine_covers`; no se descargan los PDF completos para mostrar las tarjetas. El visor abre sobre la misma página, con navegación, zoom, descarga y cierre por Escape. Los enlaces `revistas/#revista-UUID` abren directamente la revista publicada. Configurar `NEXT_PUBLIC_CDIR_PUBLIC_URL` en administración para que el enlace apunte a la web pública del entorno; en local se utiliza `http://127.0.0.1:3000/front-cdir`.

Un administrador puede eliminar un borrador tras confirmar su título. Para borrar una publicación primero debe retirarla. El backend comprueba el estado dentro de una transacción, filtra el borrado por `published=false`, comprueba la revisión concurrente, borra documento/bloques/portada y registra auditoría. No se elimina ninguna publicación real en las pruebas: se utilizó un borrador técnico temporal y se comprobó que no quedaron registros ni bloques.

Las revistas archivadas externas solo se recuperan desde HTTPS de cdir.es, comprobando cada redirección, tamaño máximo y cabecera PDF. Todos los PDF y portadas de borradores requieren sesión administradora. La tabla de portadas queda fuera del estado que se carga al navegar por la administración.
