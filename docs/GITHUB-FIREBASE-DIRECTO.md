# GitHub Pages y SQL Connect directo

El conector `cdir-browser` permite consultar la BD existente desde los navegadores sin Cloud Run. No activa Blaze, cambia tablas ni migra datos. `cdir-admin` sigue privado y sin cambios.

Las operaciones están predefinidas. Las administrativas verifican en SQL Connect la pertenencia activa y el rol ADMIN usando `auth.uid`. Las consultas de entrenador verifican además la función deportiva y su asignación al equipo. El visitante no puede introducir su uid ni elegir su rol. Google exige correo verificado. Las consultas públicas solo ofrecen contenido publicado; nunca jugadores, familias, miembros, bancos ni auditoría. Los fragmentos de PDF se verifican contra el documento autorizado y el navegador comprueba su hash.

`scripts/generate-browser-connector.mjs` genera las operaciones; `scripts/test-browser-connector.mts` comprueba con impersonación de Firebase las autorizaciones de administrador, entrenador, usuario ajeno, anónimo, correo no verificado, equipo ajeno y fragmento de PDF ajeno. Las pruebas no escriben datos.

El build de Pages es `scripts/build-pages-live.mts`, aislado en `.pages-live` e independiente del servidor original. GitHub necesita solo la configuración pública `FIREBASE_WEB_CONFIG`. Los SDK Admin, credenciales, claves bancarias y rutas de servidor no se publican. La aplicación autentica Google y consulta datos reales. No contiene selector de roles, semillas ficticias ni adaptador de almacenamiento local.

## Alcance de esta primera conexión

Lectura de administración y equipos del entrenador, calendario, partidos, revistas y contenido público. Los datos bancarios y ficheros privados quedan excluidos. No se redirigen escrituras a localStorage. Las operaciones que todavía necesitan los manejadores del servidor devuelven un mensaje explícito de no disponibilidad; no simulan guardados. La autorización por correo, sus funciones, la aceptación por Google y la activación/retirada de acceso ya utilizan operaciones transaccionales del conector. El resto de escrituras, subidas de archivos, procesos de revisión, generación de portadas en servidor y exportaciones bancarias sigue pendiente. Esto es una conexión real de consulta, no la sustitución completa de las API privadas. No presentar como completa la aplicación operativa hasta terminar y probar esas operaciones.

La prueba gratuita de Cloud SQL sigue sus propias condiciones y caducidad. Tener el frontend en Pages no amplía esa prueba ni garantiza gratuidad permanente de la BD.
