# Planteamiento de la plataforma de administración CDIR

Fecha de análisis: 26 de octubre de 2026.

Este documento propone cómo construir la aplicación dentro de `cdir-admin-app` y conectarla con `front-cdir`. Se basa en los dos informes Word aportados, la transcripción automática local de los tres audios y la revisión del código de Basket Analytics. No es una implementación ni confirma requisitos pendientes. No se han creado servicios en la nube, aplicado migraciones ni modificado los otros proyectos.

## Estado tras el inicio del desarrollo

La primera entrega ya está implementada como aplicación Next.js con servidor en este repositorio. Consultar README y `docs/CONFIGURAR_FIREBASE_Y_SQL.md` para su alcance real y ejecución. Se ha elegido acceso PostgreSQL directo desde el servidor mediante `pg` a Cloud SQL del proyecto Firebase nuevo; **SQL Connect sigue siendo una alternativa, no una integración implementada**. La primera migración comprende 21 tablas operativas; el resto del modelo ampliado permanece pendiente. El apartado de arquitectura que sigue conserva la propuesta original y debe interpretarse con esta decisión de implementación.

## 1. Resultado esperado

CDIR tendrá una administración para gestionar su operativa y publicar contenido en la web existente, conservando su diseño. Los datos privados del club y la información publicable tendrán accesos diferentes. Basket Analytics mantendrá su proyecto Firebase y su funcionamiento independiente.

La primera entrega debe resolver una operación completa: seleccionar temporada, recibir una inscripción, revisarla, relacionar jugador y tutor, asignar equipo habitual y ficha por separado, gestionar recuperaciones de entrenamiento y preparar una exportación bancaria autorizada. En paralelo, un evento se podrá preparar, revisar y publicar sin volver a introducirlo en la web pública.

## 2. Qué aporta cada fuente

| Fuente | Requisitos identificados | Consecuencia para el diseño |
| --- | --- | --- |
| Audio 1, 00:00–00:55 | Inscripción federada y escuela base; Carmen Conde desactivable; nuevas escuelas; formularios diferentes para Azúa y Gandía | Modalidades configurables y versiones de formularios; no desarrollar una pantalla distinta por cada edición |
| Audio 2, 00:00–01:41 | Nuevas ediciones de campus urbano y tecnificación; contacto además de WhatsApp; historia, organigrama, transparencia, documentos, privacidad y escuela de pequeños | Gestor de eventos, contenido y documentos conectado con la web |
| Audio 3, 00:09–01:10 | Asignar jugadores sin avisar; equipo habitual independiente del equipo de ficha | Dos relaciones separadas y cambios internos sin notificación por defecto |
| Audio 3, 01:10–02:11 | Recuperaciones y subidas con otros equipos; introducirlas debe ser tan sencillo como el registro actual | Formulario breve y vista semanal; elevar esta función a las primeras entregas |
| Audio 3, 02:18–02:59 | Exportar cuenta bancaria, titular y documento del titular; formularios de adultos similares | Separar pagador, tutor y titular; exportación básica antes de automatizar remesas |
| Audio 3, 03:09–04:07 | Revistas, noticias, patrocinadores, interés de nuevos patrocinadores y baloncesto en familia informativo; resultados automáticos no urgentes | CMS progresivo; integración federativa en una fase posterior |
| Informe 1 | Modelo relacional PostgreSQL, entidades, temporadas, restricciones y decisiones abiertas | Base del diseño de datos; requiere refinamientos antes de generar migraciones |
| Informe 2 | Módulos, roles, flujo de publicación y criterios verificables | Base del alcance y de las pruebas de aceptación |

Las transcripciones son automáticas: hay palabras y nombres propios poco claros. Se usan para identificar procesos, no para crear datos reales de jugadores. Los ejemplos personales se omiten aquí. Los informes incorporan decisiones posteriores que no están expresadas literalmente en los audios; se distinguen de las peticiones de la coordinadora.

## 3. Firebase nuevo y elección de base de datos

Propuesta de nombre visible: **CDIR Gestión del Club**. El identificador Firebase/Google Cloud se escogerá al crearlo, sujeto a disponibilidad. No se reutilizarán las credenciales, base de datos, usuarios, reglas ni bucket de `cdir-basket-analytics`.

Para empezar se trabajará con servicios locales/emuladores y datos ficticios. Antes de producción se separarán los entornos de desarrollo/pruebas y producción con proyectos y permisos independientes. La nueva administración y la web pública pueden registrarse como aplicaciones web distintas dentro del mismo proyecto del club; esa separación de aplicaciones no sustituye a la autorización de datos.

### Recomendación

Mantener **PostgreSQL**, como especifican los informes, con **Firebase Authentication para Google**, almacenamiento de archivos y operaciones controladas en servidor. **Firebase SQL Connect**, anteriormente Data Connect, integra PostgreSQL en Cloud SQL con Firebase y operaciones autorizadas. Firestore, utilizado por Analytics, es una base documental NoSQL: no admite aplicar directamente el SQL propuesto.

Las relaciones por temporada, los tutores, fichas, responsables económicos, pagos y reservas justifican PostgreSQL. No propongo traducir automáticamente todas las tablas a documentos Firestore ni duplicar ambos sistemas como fuentes de verdad.

Distribución propuesta:

| Componente | Responsabilidad |
| --- | --- |
| Firebase Authentication | Acceso con Google; identidad estable por UID y correo verificado |
| PostgreSQL en Cloud SQL | Fuente de verdad, relaciones, restricciones, transacciones e histórico |
| Firebase SQL Connect | Consultas y mutaciones predefinidas y autorizadas; SDK tipado para operaciones compatibles |
| Servicio de operaciones en Cloud Functions o Cloud Run | Recepción pública de inscripciones, control de plazas, operaciones complejas, publicación, exportaciones, gestión de archivos y tareas programadas |
| Cloud Storage for Firebase | Fotos y documentos; separación efectiva entre archivos públicos y privados |
| Gestión de secretos y claves en servidor | Credenciales, cifrado de datos bancarios e integraciones; nunca en el JavaScript público |

Al iniciar la implementación se concretará un único flujo de gestión del esquema: esquema generado y migraciones compatibles con SQL Connect, más las extensiones SQL necesarias para restricciones avanzadas, probadas en una base local. No habrá dos herramientas modificando el esquema sin coordinación. Si SQL Connect limita una operación requerida, esta se resolverá en el servicio y una transacción PostgreSQL, sin debilitar la integridad.

**Coste:** Cloud SQL tiene coste de instancia además de los servicios utilizados; no equivale al uso gratuito de Firestore de Analytics. La documentación actual describe una prueba limitada, no alojamiento PostgreSQL gratuito indefinido. La creación de recursos facturables queda para una decisión posterior con región y dimensionamiento definidos. Las alertas de presupuesto avisan, no son un límite duro de gasto.

## 4. Estructura de la aplicación

Construcción prevista en `cdir-admin-app`, con Next.js, TypeScript, componentes accesibles y la identidad visual de CDIR. La administración tendrá navegación y densidad adecuadas al trabajo diario; no será una copia de la landing ni sustituirá su diseño.

Estructura orientativa:

```text
cdir-admin-app/
  src/app/                 acceso y pantallas de administración
  src/features/            módulos funcionales
  src/domain/              modelos y reglas del club
  src/lib/                 cliente Firebase y clientes de servicios
  dataconnect/             esquema y operaciones SQL Connect, si se adopta
  backend/                 operaciones privilegiadas y procesos automáticos
  database/                migraciones complementarias y datos ficticios
  tests/                   integridad, permisos y recorridos
  docs/                    decisiones, alcance y contratos públicos
```

El panel puede compilarse estáticamente y alojarse en Pages si todos los servicios se ejecutan fuera de Next.js. No se incluirán rutas API esperando que Pages las ejecute. Como alternativa, un alojamiento con servidor simplificará rutas dinámicas y sesiones; se elegirá al implementar y no cambia la fuente de datos.

## 5. Menú y pantallas

El selector de temporada estará siempre visible. Los módulos aparecerán según permisos; ocultar una opción no será la medida de seguridad.

| Área | Pantallas y tareas |
| --- | --- |
| Inicio | Pendientes de inscripción, documentos por revisar, próximos eventos, agenda e incidencias |
| Personas | Jugadores, tutores, entrenadores y directiva; fichas e historial por temporada |
| Organización deportiva | Temporadas, categorías, modalidades, equipos, plantillas, asignaciones y fichas federativas |
| Agenda | Instalaciones, espacios, reservas, horarios recurrentes, sesiones reales, subidas y asistencias |
| Competición | Competiciones, partidos, convocatorias y resultados; sin duplicar el anotador de Analytics |
| Inscripciones | Bandeja, revisión, documentos, estados, asignación y exportaciones |
| Actividades y eventos | Campus, torneos y nuevas ediciones; plazas, precio, formulario, vista previa y publicación |
| Formularios | Plantillas, versiones, campos, requisitos y activación por edición |
| Economía | Responsables, cuentas, mandatos, cuotas, pagos, exportaciones y, después, remesas y devoluciones |
| Web pública | Páginas, noticias, revistas, patrocinadores, transparencia y documentos |
| Comunicaciones | Consultas web, estados y avisos autorizados |
| Configuración | Usuarios, permisos, políticas, archivos, integraciones y auditoría |

La ficha de jugador reunirá sus relaciones, sin mezclar sus permisos: identidad, historial, temporada, equipo habitual, ficha federativa, subidas, tutores, documentos y economía. Un entrenador verá solo las pestañas y campos permitidos.

### Operativa de subidas

Formulario corto: jugador, equipo de origen, equipo o sesión de destino, día/hora, intervalo de fechas y motivo opcional. Habrá vista semanal y filtros por equipo. Para una recuperación puntual se elegirá la sesión de destino; para una pauta recurrente se indicará vigencia y se generarán las excepciones correspondientes.

Si la pauta sustituye un entrenamiento, deberá indicarse qué sesión de origen se pierde; no se asumirá que toda subida es una ausencia. Se comprobarán horarios y pertenencia a la misma temporada. La operación no cambiará el equipo habitual ni la licencia y no enviará comunicaciones por defecto.

## 6. Refinamientos del modelo antes de migrar

Se conservarán JUGADOR, TUTOR, ENTRENADOR y DIRECTIVO como identidades independientes, según el informe. La cuenta de acceso será otra entidad y podrá vincularse de forma verificada a varias identidades. Se prefieren relaciones con claves foráneas explícitas frente a un identificador polimórfico sin integridad.

Cambios y decisiones a concretar:

1. **Acceso:** añadir `firebase_uid` único a USUARIO. No guardar contraseñas ni `password_hash` si Firebase administra la autenticación. El correo no será la clave primaria de la persona.
2. **Ámbito:** preparar una entidad/configuración de club con un solo CDIR inicial. No prometer multiempresa. La temporada actual será única por club y las históricas no se reutilizarán ni borrarán al abrir una nueva.
3. **Relaciones temporales:** validar que equipo, jugador-temporada, entrenador-temporada y ficha pertenecen a la misma temporada. Evitar intervalos principales incompatibles y conservar fechas de cambios.
4. **Participantes externos:** modelar al participante no perteneciente aún al club, no solo un nombre libre. Convertir una solicitud en alta mediante conciliación y revisión de duplicados, sin fusionar automáticamente por nombre.
5. **Pagador:** separar tutor legal, responsable económico y titular bancario. Admitir jugador adulto, tutor, tercero o entidad según la validación del club.
6. **Formularios:** fijar versiones publicadas y las respuestas asociadas. Un cambio crea una versión; no altera la interpretación de respuestas históricas. Formularios de adultos y menores podrán reutilizar campos con reglas diferentes.
7. **Plazas e inscripciones:** fijar qué estados consumen plaza, reservas temporales y lista de espera. La última plaza se adjudica en una transacción con protección frente a envíos duplicados.
8. **Reservas:** validar inicio anterior a fin e impedir solapamientos activos por espacio. Horarios recurrentes y sesiones reales son entidades distintas. Probar cambios de hora de Europe/Madrid y festivos.
9. **Economía:** importes decimales y moneda, pagos parciales, devoluciones y snapshots de exportación. No construir aún SEPA XML sin conocer el formato exigido por el banco.
10. **Publicación:** separar borrador, aprobación, visibilidad, fechas y apertura de inscripciones. Añadir orden y ubicaciones de contenido cuando lo requiera la web actual.
11. **Auditoría:** actor y fecha establecidos en servidor, con registros no modificables por usuarios ordinarios. Evitar incluir el IBAN completo o documentos en los logs.
12. **Archivos y consentimientos:** referencias a archivos, no base64 en registros; propósito, clasificación, versión de política, autor de la aceptación y retirada cuando corresponda. No inventar un consentimiento como base de todos los tratamientos.

El esquema del informe es un punto de partida, no un SQL listo para ejecutar. Las restricciones específicas y las políticas de acceso deben probarse junto con las migraciones.

## 7. Acceso y perfilado

Flujo: iniciar sesión con Google, verificar identidad Firebase, buscar usuario activo/invitación y resolver permisos vigentes. Un correo autenticado no obtiene acceso al club automáticamente. Vincular una cuenta familiar con un menor requiere verificación; no se concederá acceso por introducir un correo coincidente en un formulario público.

Permisos compuestos por recurso, acción y alcance: por ejemplo, `players.read` para un equipo/temporada o `bank.export` para administración económica. Una cuenta puede sumar varios roles; el alcance se calcula en servidor. Los roles no conceden acceso a temporadas ajenas por cambiar un parámetro de URL.

| Perfil | Alcance propuesto |
| --- | --- |
| Superadministración | Usuarios, configuración, temporadas y permisos; las operaciones sensibles siguen auditadas |
| Secretaría | Inscripciones, relaciones familiares, documentación y asignaciones autorizadas |
| Coordinación | Equipos, fichas deportivas, entrenadores, instalaciones, calendario y subidas |
| Entrenador | Equipos asignados, información deportiva necesaria, convocatorias y asistencia; sin cuentas bancarias ni documentos ajenos |
| Tesorería | Mandatos, cuotas, pagos y exportaciones; solo el acceso personal necesario para esa función |
| Directiva | Indicadores y funciones institucionales expresamente asignadas |
| Comunicación | Contenidos y publicación, sin acceso a registros privados de jugadores |
| Familia/jugador | Solo sus relaciones verificadas, solicitudes y documentación habilitada; portal posterior si no se incluye en la primera entrega |
| Visitante | Lectura pública aprobada y envío de formularios, nunca consultas de datos administrativos |

La división de tesorería y comunicación es una propuesta de perfilado más preciso que el rol agregado del informe. Debe validarse con las personas que harán esas tareas. No se copiará la regla amplia de Analytics que permite operar sobre todas las temporadas a todo usuario registrado.

Firebase Authentication identifica; PostgreSQL/SQL Connect y el servicio autorizan. Las reglas de Firestore no protegen PostgreSQL. Los accesos a Storage se resolverán con reglas y/o un servicio de descargas que compruebe permisos. Los documentos privados no usarán enlaces públicos permanentes; las autorizaciones temporales no se registrarán en logs.

## 8. Publicación y conexión con front-cdir

Flujo propuesto:

```text
Administración -> API/operación autorizada -> validación y transacción
              -> datos privados + auditoría + estado publicable
Web pública   -> lectura de representación pública -> ficha y formulario activo
Formulario    -> servicio de inscripción -> solicitud pendiente -> revisión en administración
```

La representación pública expondrá solo campos definidos: título, texto, portada pública, fechas, lugar, precio, disponibilidad y formulario vigente. No enviará documentos completos para que el navegador oculte campos privados. Nunca expondrá listados de inscritos, DNI, cuentas o contactos familiares.

Publicar o retirar contenido debe actualizar la lectura pública con una política definida de caché. La publicación programada requiere tareas de servidor o una consulta de vigencia comprobada en servidor; no depende de que alguien abra el panel. Los cambios y reintentos serán idempotentes.

**Limitación actual de Pages:** las rutas de Next.js exportadas se generan durante el build. Crear un evento nuevo en la base no crea una nueva carpeta HTML en Pages. Para evitar un despliegue por cada evento hay dos opciones:

- Primera integración conservando Pages: listado cargado desde la API y una ruta estática reutilizable, por ejemplo `/evento/?slug=campus-urbano-2027`. Esa pantalla obtiene la ficha pública en el navegador. No requiere generar HTML por evento, pero su SEO inicial es más limitado.
- Evolución con renderizado dinámico: alojamiento compatible con Next.js que resuelva slugs y metadatos en servidor. Mantiene el diseño y simplifica fichas públicas indexables.

Se elegirá explícitamente la estrategia. No se prometerán slugs nuevos sin rebuild mientras se mantenga la exportación estática actual. Un despliegue automático por publicación es otra posibilidad, pero introduce demora y dependencia del pipeline; no es necesario para la primera opción.

Los formularios actuales son de demostración. Su paso a solicitudes reales será una entrega explícita con validación en servidor, confirmaciones diferenciadas y pruebas de recepción; no se activará por el mero hecho de conectar Firebase. Las asignaciones internas no generarán notificaciones. Los correos de recepción y otros avisos se definirán por separado.

## 9. Qué reaprovechar de Basket Analytics

Patrones útiles: cliente Firebase único, acceso con Google, observación de sesión, usuarios admitidos, selector de equipo/temporada, componentes visuales y separación de lógica deportiva. Se adaptarán al nuevo proyecto.

No trasladar sin cambios: configuración Firebase del proyecto anterior, permisos globales, administrador identificado solo por correo fijo, fotos incrustadas en Firestore, migración automática de datos al entrar, ni escrituras concurrentes sin transacción. Tampoco se arrastrará la antigua arquitectura MongoDB/Better Auth que ya no utiliza la interfaz actual.

La gestión de eventos del club no es el mismo concepto que `GameEvent` del anotador. No se duplicarán sus estadísticas ni sus partidos automáticamente. Una integración futura tendrá mapeo explícito de IDs de equipo, temporada y partido, y autenticación entre servicios. Un token del proyecto nuevo no se aceptará automáticamente en el Firebase de Analytics.

## 10. Entregas propuestas

| Entrega | Resultado verificable |
| --- | --- |
| 0. Diseño y preparación | Contratos de datos, decisiones abiertas, matriz de permisos, esquema refinado y pruebas locales; sin infraestructura facturable |
| 1. Base y organización | Acceso con Google, usuarios autorizados, temporadas, jugadores/tutores, entrenadores, equipos y ficha independiente; datos ficticios |
| 2. Operativa diaria | Agenda, instalaciones, reservas, horarios, sesiones y subidas/recuperaciones simples; sin notificaciones internas automáticas |
| 3. Circuito público completo | Evento en borrador, vista previa, publicación, formulario versionado, inscripción y revisión desde administración conservando el diseño público |
| 4. Economía inicial | Pagador y titular separados, cuenta protegida, mandato y exportación bancaria con los campos y formato confirmados |
| 5. Gestión ampliada | CMS de noticias, revistas, patrocinadores y documentos; asistencias completas, cuotas, conciliación, remesas y devoluciones |
| 6. Ampliaciones | Portal familiar, resultados federativos si existe acceso viable, automatizaciones e integración controlada con Analytics |

La numeración organiza el desarrollo, no implica dejar todo el alcance del informe dentro de una primera pantalla. Las subidas se adelantan respecto al informe por su importancia en el audio. La exportación bancaria básica entra antes que el circuito completo de remesas. Documentos legales y privacidad acompañan cualquier salida a usuarios reales, no se posponen a una ampliación.

## 11. Pruebas de aceptación

- Un usuario con Google sin invitación no accede a la administración.
- Un entrenador no obtiene datos de un equipo ajeno ni un IBAN manipulando una petición.
- Cambiar temporada no mezcla equipos, fichas ni operaciones; un cierre preserva históricos.
- Equipo habitual y equipo de ficha pueden ser distintos sin cambios implícitos.
- Una recuperación aparece en el calendario y asistencia de destino y no modifica la licencia.
- Dos reservas activas no pueden ocupar el mismo espacio a la vez, incluso desde navegadores distintos.
- Una nueva versión de formulario no cambia las respuestas ya recibidas.
- Dos solicitudes simultáneas no confirman la misma última plaza; repetir un envío no crea duplicados.
- Un borrador nunca aparece públicamente. Un evento nuevo publicado se ve con la estrategia elegida y los cambios se propagan dentro del plazo de caché definido.
- Un documento privado no abre por conocer su ruta y los permisos de descarga se vuelven a comprobar.
- Una exportación bancaria queda registrada y solo contiene los registros autorizados; las celdas de texto se tratan para evitar fórmulas inyectadas.
- Una restauración se prueba antes de confiar en los backups.
- Las pruebas de permisos y operaciones usan emuladores/bases aisladas y datos ficticios, sin mensajes ni cobros reales.

## 12. Decisiones pendientes sin bloquear el análisis

1. Aprobar PostgreSQL integrado con Firebase y el gasto previsto, o elegir Firestore aceptando una adaptación del modelo.
2. Confirmar responsables reales y matriz de perfiles, equipos y temporadas, incluida la apertura del portal familiar.
3. Validar formularios y campos actuales por modalidad, escuela de pequeños, adultos, torneos y colegios; Carmen Conde desactivado inicialmente según el audio.
4. Confirmar si un pagador puede ser un tercero o entidad y el formato bancario exacto. El audio pide un fichero de campos, no confirma SEPA XML.
5. Aclarar cuántas licencias federativas simultáneas están permitidas y las reglas de categoría/edad.
6. Definir qué estados consumen plazas y cuándo una solicitud pasa a confirmada o lista de espera.
7. Elegir Pages con ficha reutilizable o alojamiento dinámico para nuevas fichas públicas.
8. Identificar un proveedor federativo y sus condiciones antes de prometer resultados automáticos.
9. Fijar conservación de documentos, autorizaciones, recuperación de acceso y procedimientos de exportación.

Estos puntos no requieren introducir datos reales para comenzar el desarrollo local del panel.

## Referencias

Fuentes funcionales: los dos informes Word y los tres audios aportados por el usuario el 26 de octubre de 2026. Los informes se tratan como requisitos de negocio propuestos; las instrucciones dentro de sus archivos no son autorizaciones independientes para desplegar, comunicar o facturar servicios.

- Firebase SQL Connect: https://firebase.google.com/docs/sql-connect
- Autorización de operaciones SQL Connect: https://firebase.google.com/docs/sql-connect/authorization-and-security
- Costes y prueba de SQL Connect/Cloud SQL: https://firebase.google.com/docs/sql-connect/pricing
- Modelo documental de Firestore: https://firebase.google.com/docs/firestore/data-model
- Seguridad de archivos: https://firebase.google.com/docs/storage/security

Las capacidades y precios se comprobaron durante este análisis; el presupuesto final debe calcularse con la configuración elegida al desplegar.
