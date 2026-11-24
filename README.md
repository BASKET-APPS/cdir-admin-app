# CDIR Administración

Aplicación Next.js con servidor, React y TypeScript. Proyecto separado de `front-cdir` y `basket-analytics`. No es una exportación estática ni se puede ejecutar su backend en GitHub Pages.

## Ejecutar localmente

Requiere Node.js 24.12 o superior (versión indicada en `.nvmrc`).

```sh
npm ci
npm run dev
```

Abrir http://127.0.0.1:3002 y pulsar **Entrar en la demostración**. Sin `.env.local`, en desarrollo se activa el modo local con datos ficticios. Solo acepta el acceso de demostración desde localhost. Guarda los cambios en `.local/workspace.json` y documentos en `.local/files/`, excluidos de Git. No se envían comunicaciones ni se realizan cargos. No introducir información real en este entorno.

En producción no hay acceso de demostración ni datos de respaldo: la aplicación requiere Firebase y PostgreSQL y falla si no están configurados. `npm start` inicia producción después de `npm run build`; la demostración se prueba con `npm run dev`.

## Primera entrega implementada

- Acceso local de desarrollo y conexión de login con Google preparada para un Firebase nuevo.
- Autorización de operaciones en servidor; perfiles administrativos, deportivos, tesorería y comunicación; entrenadores limitados a equipos asignados.
- Selector, alta, temporada actual y cierre de temporadas.
- Alta y edición de jugadores con tutor opcional; equipo habitual y equipo de ficha independientes.
- Alta de equipos y entrenadores con asignación inicial.
- Instalaciones, sesiones semanales, comprobación de reservas y cancelaciones.
- Subidas/recuperaciones puntuales y asistencia por sesión.
- Creación, edición, vista previa, publicación/retirada de eventos; apertura independiente de inscripción.
- Plantillas de formulario versionadas, campos adicionales de texto y desactivación sin borrar solicitudes.
- Ficha pública de prueba en `/evento?slug=...`, solicitudes pendientes, confirmación/rechazo con control de plazas e idempotencia.
- Cuotas, registro manual de pago, cuentas y referencias de autorización, cifrado de IBAN/documento y exportación CSV auditada. No genera SEPA ni valida firmas.
- Noticias, patrocinadores, páginas y documentos como contenidos de texto/enlace publicables.
- Cuenta administrativa y altas/retirada de usuarios por UID de Firebase.
- Archivos privados por jugador; descarga autorizada y auditada, PDF/JPG/PNG/WebP hasta 5 MB.
- PostgreSQL: 22 tablas, claves foráneas, restricciones de misma temporada, exclusión de reservas y auditoría append-only.

## Conexión real y base de datos

La configuración activa usa **Firebase SQL Connect** en `cdir-apps`, servicio `cdir-apps-2-service`, base `cdir-apps-2-database`, región Madrid. Ya se han desplegado las 22 entidades del club, sus relaciones y el conector privado, además de una tabla técnica de revisión. El servidor Next.js utiliza Firebase Admin SQL Connect; la base local y el adaptador `pg` se conservan únicamente para pruebas/compatibilidad y no se usan en este modo.

Leer `docs/CONFIGURAR_FIREBASE_Y_SQL.md` para credenciales, primer administrador, migraciones y Storage. La primera cuenta requiere un acceso Google y ejecutar `db:bootstrap:firebase` con su correo. La nube no importa los registros ficticios locales. Los dominios de desarrollo están autorizados en Authentication.

## Navegación y diseño

El panel comparte la paleta CDIR y las fuentes locales DM Sans y Barlow Condensed de `front-cdir`. El menú se organiza en Inicio y seis grupos desplegables: Personas, Equipos, Actividades, Web pública, Gestión y Configuración. La barra se puede contraer, recuerda la preferencia y ofrece submenús accesibles con teclado. En móvil se usa un panel lateral; las pestañas contextuales permiten cambiar de sección dentro de cada grupo. Entrenadores sustituye a Equipo técnico. Equipo habitual y equipo de licencia se explican en la plantilla y la ficha del jugador.

La preferencia de anchura se guarda en localStorage; no guarda datos personales. Las autorizaciones de servidor y los permisos de cada apartado se mantienen.

## Comprobaciones

```sh
npm run check
npm test
npm run build
npm run test:e2e
node scripts/navigation-test.cjs
```

Las pruebas de dominio y SQL utilizan datos ficticios. PGlite ejecuta el esquema PostgreSQL completo con btree_gist y verifica claves foráneas, reservas y auditoría. Las pruebas de navegador requieren el servidor local de desarrollo en 3002 y Edge instalado. La conexión real SQL Connect se comprueba mediante `npm run test:sql-connect`. Authentication está configurado; la validación de acceso personal requiere completar el login Google. Storage sigue pendiente de crear.

## Límites de esta entrega

Es una primera aplicación funcional, no todos los módulos del informe están terminados. Faltan: histórico completo de movimientos con vigencias, varias licencias simultáneas, responsable económico distinto del titular, flujo de firma/validación de mandato, pagos parciales/devoluciones, exportación SEPA/XLSX, series avanzadas de recuperaciones, constructor de formularios con todos los tipos/condicionales y consentimientos reales, portal familiar, resultados federativos e integración con Basket Analytics.

La web pública existente no se ha modificado. `/api/public/events` es la lectura preparada para integrarla, pero el frontend publicado de CDIR aún no consume estos datos. El envío público está bloqueado fuera de desarrollo hasta establecer `PUBLIC_REGISTRATION_ENABLED=true`; sus textos y circuito de inscripción deben completarse antes de habilitarlo para familias reales. La interfaz pública actual es de prueba, no sustituye los formularios del club.

El limitador de solicitudes actual es por proceso; para desplegar varias instancias se necesita un límite compartido/App Check o protección de infraestructura. La primera persistencia PostgreSQL carga el estado del club y serializa las operaciones mediante un bloqueo transaccional; adecuada para validar el circuito, debe evolucionar a consultas por módulo y paginación antes de grandes volúmenes. Las claves de cifrado necesitan custodia y política de rotación; el cifrado no equivale por sí solo a cumplimiento legal.

Para documentos privados se usa acceso del servidor/IAM y reglas de Storage que bloquean clientes directos. La limpieza/retención, detección de archivos maliciosos, backups, restauración y observabilidad de producción quedan pendientes de configurar. Nunca subir credenciales, claves de servicio o datos reales al repositorio.


## Perfiles y PostgreSQL local

`npm run db:local` prepara un clúster PostgreSQL aislado en `.local/postgres`, puerto 55433, base `cdir_club_local`, aplica las migraciones y configura `.env.local`. Requiere PostgreSQL instalado en Windows y Node 24. Los datos iniciales son ficticios. Es idempotente: no sustituye los registros existentes. `npm run db:local:stop` detiene el servidor conservando los datos. Después se puede volver a iniciar con `npm run db:local`.

Con DATABASE_URL local configurada, la aplicación usa PostgreSQL incluso con autenticación de demostración. Sin DATABASE_URL, conserva el antiguo almacén JSON. La autenticación de demostración está prohibida contra bases remotas y en producción.

Mi perfil (`/perfil`) permite elegir la imagen de Google, una foto propia o iniciales. La migración `002_user_profiles.sql` relaciona el perfil con `members.uid`. SQL guarda la preferencia y la referencia del archivo; las imágenes privadas se guardan localmente en `.local/avatars` en demostración y en Firebase Storage en modo real. Las subidas se decodifican, normalizan a WebP de 320 px y se eliminan los metadatos. Solo el propietario puede leer o modificar su imagen. La foto de Google se obtiene del proveedor mediante Firebase Admin; la selección manual se conserva al sincronizar.

Comprobación de perfiles con el servidor de desarrollo activo: `node scripts/profile-test.cjs`. Verifica subida, persistencia tras recarga, cambio de preferencia, protección de descarga y eliminación. La prueba deja auditoría de sus operaciones ficticias.

La base local ya funciona; no implica que exista una instancia Cloud SQL conectada. Para producción falta crear o conectar PostgreSQL en el proyecto Google Cloud `cdir-apps`, proporcionar DATABASE_URL y credenciales de servidor de Firebase, configurar Storage privado y autorizar el UID del administrador. Ejecutar `npm run db:migrate` aplica ambas migraciones al destino configurado. No compartir claves privadas ni subir `.env.local` a Git.

El apartado PostgreSQL local anterior describe la alternativa de pruebas; no es la configuración activa. SQL Connect se activa explícitamente con CDIR_DATABASE=sql-connect y nunca usa autenticación de demostración.

## Gestión ampliada del club

Consultar [docs/OPERACIONES_CLUB.md](docs/OPERACIONES_CLUB.md). Ya están cargados los 18 equipos por temporada, las tres temporadas, jugadores/familias/entrenadores y calendarios en Firebase. Se incorporan partidos/resultados, solicitudes de refuerzo, notificaciones, revisión de bajas y revistas PDF. Las reglas y permisos tienen pruebas específicas; el sénior procede de la plantilla real de Basket Analytics y los históricos están identificados como simulados.
