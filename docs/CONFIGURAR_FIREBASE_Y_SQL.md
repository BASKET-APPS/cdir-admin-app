# Firebase SQL Connect · CDIR

## Configuración actual

- Proyecto: `cdir-apps`, independiente de Basket Analytics.
- Servicio: `cdir-apps-2-service`.
- Región: `europe-southwest1` (Madrid).
- Instancia: `cdir-apps-instance` (PostgreSQL 18).
- Base: `cdir-apps-2-database`.
- Conector privado: `cdir-admin`.

El esquema está en `dataconnect/schema/schema.gql`: 22 entidades relacionales y una tabla técnica `workspace_revision`. El servidor Next.js utiliza Firebase Admin SQL Connect; las operaciones administrativas llevan `NO_ACCESS` y no se publican operaciones de lectura/escritura directa para clientes. La autorización por rol y equipo se comprueba en las rutas del servidor tras verificar el token Firebase.

La tabla de revisión serializa las escrituras mediante una comparación de versión dentro de una mutación `@transaction`. Si dos cambios parten de la misma revisión, solo uno confirma. El otro debe recargar; no se reejecutan automáticamente acciones con efectos sobre archivos. Las lecturas se paginan y comprueban la revisión antes y después para evitar mezclar estados.

## Variables

En `.env.local`:

```text
CDIR_MODE=firebase
CDIR_DATABASE=sql-connect
FIREBASE_PROJECT_ID=cdir-apps
SQL_CONNECT_SERVICE_ID=cdir-apps-2-service
SQL_CONNECT_LOCATION=europe-southwest1
APP_ORIGIN=http://127.0.0.1:3002
```

Se conservan las variables públicas de la app Firebase. Con SQL Connect no se utiliza DATABASE_URL. No se permite la autenticación de demostración contra SQL Connect ni se recurre al almacén local cuando falla la nube.

En desarrollo, las credenciales se prepararon desde la sesión Firebase CLI autorizada en `.local/firebase-adc.json`, excluido de Git. La ruta está en GOOGLE_APPLICATION_CREDENTIALS. No distribuir ese archivo. `scripts/firebase-local-credentials.cjs` permite repetir la configuración indicando FIREBASE_TOOLS_DIR. En producción utilizar una identidad administrada con los permisos mínimos necesarios, no la sesión personal del desarrollador.

## Primer administrador

La instalación local tiene BOOTSTRAP_ADMIN_EMAIL configurado exclusivamente con el correo del propietario. En el primer acceso Google verificado se autoriza ese UID si no existe ningún miembro; la creación se serializa y audita. No se autoriza ningún otro correo y el mecanismo deja de funcionar en cuanto hay miembros. Retirar la variable tras el primer acceso. También se dispone de un script manual: el propietario debe entrar una vez con Google para crear su usuario en Firebase Authentication. Los dominios `127.0.0.1` y `localhost` ya están autorizados. Después ejecutar:

```powershell
$env:ADMIN_EMAIL='CORREO_DEL_PROPIETARIO'
npm run db:bootstrap:firebase
```

El script exige correo verificado, busca el UID real en Authentication y solo permite inicializar un propietario cuando no hay otros miembros, o reautorizar ese mismo UID existente. No importa datos ficticios ni crea una temporada automáticamente. Crear la primera temporada en el apartado Temporadas de la aplicación.

## Esquema y restricciones

`npm run db:schema` genera el contrato desde las migraciones SQL verificadas. No ejecutar `db:migrate` contra la base SQL Connect: ese comando pertenece al adaptador PostgreSQL anterior.

```sh
firebase dataconnect:compile --project cdir-apps
firebase dataconnect:sql:diff --project cdir-apps
firebase dataconnect:sql:migrate --project cdir-apps
firebase deploy --only dataconnect --project cdir-apps
```

Revisar siempre el diff antes de aplicar cambios. El modo COMPATIBLE conserva restricciones adicionales. `dataconnect/relational-guards.sql` incluye CHECK, índices parciales, exclusión de reservas, versionado de formularios y auditoría inmutable. `scripts/sql-connect-guards.cjs` aplica estas restricciones con IAM del propietario mediante Firebase CLI (FIREBASE_TOOLS_DIR requerido). No usar modo STRICT: podría quitar restricciones personalizadas. CoachTeam conserva su UUID y la unicidad entrenador/equipo; el aviso del compilador sobre clave de tabla intermedia es una recomendación, no una operación pública insegura.

## Imágenes y documentos

La preferencia y referencia de imagen se guardan en `user_profiles`, vinculada por UID a `members`. La foto Google proviene del proveedor verificado con Firebase Admin. Las fotos propias y documentos requieren un bucket Storage privado. El bucket aún no está creado; por eso FIREBASE_STORAGE_ENABLED y NEXT_PUBLIC_PROFILE_UPLOAD_ENABLED están en false. No se ha activado facturación para crearlo.

Cuando se configure el bucket, revisar el plan solicitado, desplegar `storage.rules` que deniega acceso directo y habilitar ambas variables. El servidor comprueba propiedad/permisos y usa IAM; no genera URLs públicas con tokens permanentes.

BANK_ENCRYPTION_KEY debe ser una clave de 32 bytes custodiada en Secret Manager al desplegar. Mantener PUBLIC_REGISTRATION_ENABLED=false hasta completar los textos y el circuito real de inscripción.

## Verificaciones

`npm test`, `npm run check`, `npm run build`. `npm run test:sql-connect` usa el servicio real: comprueba las 22 entidades, el contrato de escritura, rollback y exclusión de escrituras concurrentes. Solo modifica la revisión técnica; no carga los datos de demo. El test E2E antiguo exige un servidor con JSON y no debe ejecutarse contra la nube.

La prueba Spark de la consola muestra como fecha límite el 24 de enero de 2027. Revisar el plan antes de esa fecha para evitar archivado. No se ha cambiado el plan Spark.
