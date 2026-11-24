# Publicación de las dos webs CDIR

## Destinos

- Código: repositorios `BASKET-APPS/front-cdir` y `BASKET-APPS/cdir-admin-app`.
- Pública: `https://basket-apps.github.io/front-cdir/`, exportación estática en GitHub Pages.
- Administración prevista: `https://cdir-apps.web.app/`, Firebase Hosting con reescritura a Cloud Run `cdir-admin-app` en Madrid.
- Base existente: proyecto `cdir-apps`, servicio `cdir-apps-2-service`. No utilizar el proyecto de Basket Analytics.

Basket Analytics usa Firebase Auth y Firestore directamente desde el navegador. CDIR utiliza Firebase Admin y PostgreSQL/SQL Connect en API privadas de Next.js. GitHub Pages no ejecuta estas API. Por eso la administración necesita el servidor Cloud Run; no se puede convertir en una exportación estática conservando la arquitectura actual.

La pública utiliza `NEXT_PUBLIC_CDIR_API_URL=https://cdir-apps.web.app` durante el build. Revistas, partidos y actividades llaman únicamente a API públicas con campos permitidos. Los datos privados siguen detrás de Firebase Authentication y los permisos de la aplicación. No publicar conectores SQL administrativos como `PUBLIC`.

## Estado comprobado el 24/11/2026

La consulta de Cloud Billing devolvió `billingEnabled: false`. Firebase está activo. El listado de Cloud Run devolvió 403: no confirma por sí mismo si existe un servicio. No se ha activado facturación ni desplegado recursos de pago.

## Preparación única en Google Cloud, después de activar Blaze

1. Habilitar Cloud Run, Artifact Registry, Secret Manager, IAM Credentials y Security Token Service en `cdir-apps`. Mantener SQL Connect existente, sin migrar tablas ni crear otra BD.
2. Crear repositorio Docker `cdir-apps` en Artifact Registry, región `europe-southwest1`.
3. Crear una identidad de ejecución `cdir-runtime@cdir-apps.iam.gserviceaccount.com`. Necesita `roles/firebasedataconnect.dataAdmin` para las consultas y mutaciones del servidor y `roles/firebaseauth.viewer` para comprobar usuarios y revocaciones. No otorgar Owner/Editor.
4. Guardar en Secret Manager `cdir-bank-key` y `cdir-retention-job`. Reutilizar EXACTAMENTE las claves actuales cuando existan: cambiar la bancaria impediría descifrar datos guardados. Si falta una clave y ya existen datos cifrados, detener la preparación y recuperar la original. No subir claves a GitHub ni pasarlas como argumentos de Docker.
5. Conceder al runtime Secret Accessor solo sobre esos dos secretos. Storage permanece deshabilitado en este despliegue; su activación y permisos son una tarea posterior.
6. Crear identidad de despliegue y Workload Identity Federation para GitHub Actions. Restringir el proveedor al repositorio `BASKET-APPS/cdir-admin-app`, rama `main` y entorno `production`. Preferir también los ID numéricos del repositorio y propietario para evitar confiar solo en nombres.
7. La identidad de despliegue necesita publicar imágenes en ese repositorio, desplegar Cloud Run, configurar su invocación pública y desplegar Firebase Hosting. Conceder Service Account User solo sobre la identidad runtime. Los permisos de despliegue no deben trasladarse al runtime. Acotar Run Admin al servicio cuando ya exista; la primera creación puede requerir preparación por el propietario.
8. Confirmar que el sitio Firebase Hosting `cdir-apps` pertenece a este proyecto y que no aloja otra aplicación antes de aplicar la reescritura.
9. Confirmar que Firebase Authentication autoriza `cdir-apps.web.app` y que las restricciones de la clave web permiten ese origen. Mantener las restricciones privadas del servidor.

La cuenta de GitHub debe poder usar el entorno `production`. El workflow usa OIDC/WIF y no necesita descargar una clave JSON de servicio.

## Variables de GitHub

En el repositorio de administración, configurar:

- `FIREBASE_WEB_CONFIG`: JSON público de la app web de `cdir-apps`, con `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` y `appId`. No contiene credenciales Admin.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: nombre completo del proveedor WIF.
- `GCP_DEPLOY_SERVICE_ACCOUNT`: identidad de despliegue.
- `GCP_RUNTIME_SERVICE_ACCOUNT`: identidad runtime.

El workflow `Deploy CDIR administration` se ejecuta manualmente desde `main`. No crea la BD, no despliega su esquema y no activa Storage ni inscripciones reales.

Después del despliegue del servidor, configurar en `front-cdir` la variable `CDIR_ADMIN_API_URL=https://cdir-apps.web.app` y ejecutar su workflow. Un chequeo impide publicar el build sin un origen HTTPS válido. No usar localhost ni la dirección de GitHub Pages como API.

Para las revisiones semanales: variable `CDIR_ADMIN_URL=https://cdir-apps.web.app` y secreto GitHub `RETENTION_JOB_SECRET`, idéntico al guardado en Secret Manager. El workflow existente conserva su función de solicitar avisos de revisión.

## Comprobación de publicación

1. Login Google en administración, lectura de los equipos autorizados y rechazo a cuentas no autorizadas.
2. `/api/workspace` sin token debe devolver 401. La invocación pública de Cloud Run permite llegar al login y a las API públicas, no evita la autorización interna.
3. Desde la pública, comprobar revistas, PDF, resultados y calendario. Publicar una actividad de prueba autorizada desde administración y comprobar su aparición en la pública.
4. Revisar HTTPS, CORS y ausencia de solicitudes a `127.0.0.1` en el navegador publicado.
5. Verificar generación de portadas PDF en Linux, exportaciones y recuperación de los secretos correctos.

Cloud Run configura mínimo cero y máximo dos instancias, 1 CPU y 2 GiB. Son límites de capacidad, no un tope de factura. Mantener las alertas de presupuesto y contrastar consumo real con la estimación anual antes de cerrar una tarifa.

No cambiar `APP_ORIGIN` sin actualizar el origen real de administración: protege las escrituras. El cambio futuro a `admin.cdir.es` necesita actualizar ese valor y los dominios autorizados. La web pública puede permanecer en Pages o pasar posteriormente a `cdir.es` con su basePath correspondiente.
