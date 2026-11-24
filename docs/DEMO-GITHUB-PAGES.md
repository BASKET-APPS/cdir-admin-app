# Demostración compartible

La acción `pages.yml` publica https://basket-apps.github.io/cdir-admin-app/ con las pantallas actuales y un club completamente sintético. No requiere Blaze ni credenciales. La acción de producción `deploy.yml` sigue siendo manual e independiente.

Ejecutar `node --import tsx scripts/build-pages-demo.mts` con Node 24. El script genera `.pages-demo/` (ignorado por Git), copia únicamente componentes, dominio, recursos públicos y estilos, y exporta las secciones estáticas. Nunca copia rutas API, código de servidor, `.env` ni credenciales. La autenticación Firebase se sustituye solo en el árbol generado por un selector de perfiles ficticios.

Los comandos deportivos reutilizan las validaciones del dominio y persisten en localStorage. No son cambios del club real y no se comparten entre visitantes. La franja de demo permite restablecerlos. Las operaciones que necesitan el servidor responden con un mensaje explícito; no se envían a Firebase. No utilizar esta demo para almacenar información personal real.

La web pública de demostración lee el feed estático sintético. En el mismo navegador y origen de GitHub Pages, puede mostrar los cambios guardados en la administración mediante `cdir-demo-public-feed-v1`. Entre navegadores diferentes se mantiene el feed inicial. Publicación real multiusuario requiere el backend de producción.

Para producción, seguir DESPLIEGUE.md; la demo no cambia permisos, SQL Connect ni recursos de Google Cloud.
