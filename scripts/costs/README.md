# Simulaciones reproducibles de costes CDIR

Solo `front-cdir` y `cdir-admin-app`, compartiendo una BD. No incluye basket-analytics.
Node **24.12 o posterior**. No hacen falta Firebase CLI, credenciales ni `.env.local`.

Desde `cdir-admin-app`, ejecutar en orden:

```powershell
node --import tsx scripts/costs/measure.mts
node --import tsx scripts/costs/measure.mts ../_simulacion-costes-2026-11-15 --growth
node scripts/costs/simulate.mjs
```

Se generan `measurements-base.json`, `measurements-growth.json`, `simulation.json`,
`meses.csv`, `INFORME.md` y `resumen.html` en `_simulacion-costes-2026-11-15`.
Se puede abrir el HTML directamente; no necesita servidor, scripts ni servicios externos.

Para repetir otro escenario, copiar `scenarios.json`, cambiar los supuestos y ejecutar:

```powershell
node scripts/costs/simulate.mjs ruta/a/mi-escenario.json ../_simulacion-costes-2026-11-15
```

## Qué es cada resultado

- **Medido localmente:** manejadores reales, llamadas GraphQL, bytes UTF-8 de respuesta
  del SDK y del HTTP, validación funcional y estados HTTP contra un simulador en memoria.
- **Supuesto:** frecuencia mensual de acciones, visitas, patrón uniforme de caché,
  instancias, fracción de 304, tamaño de página, CPU Cloud Run y tarifas marcadas como
  aproximaciones. Los 20 MiB del PDF se ejercitan en el código real de fragmentación.
- **No medido:** ejecución de PostgreSQL, sus planes/índices, CPU, memoria, concurrencia,
  latencia real, comportamiento exacto del visor PDF, facturación y SKUs reales.
- **Prototipo aislado:** `scoped-registration.mts` usa el comando de validación de la
  aplicación, carga solo la actividad, formularios y solicitudes relacionadas y emplea
  el control de revisión existente. No lo importa ninguna ruta de producción. Antes de
  integrarlo faltan pruebas de concurrencia, reintentos e idempotencia, entre otras.

## Controles de seguridad

`measure.mts` intercepta `firebase-admin/data-connect` y el módulo de inicialización de
Firebase antes de cargar los manejadores. El SDK devuelve `FakeSqlConnect`. Se bloquea
`fetch`; el acceso a Storage produce un error. No se leen archivos de entorno ni claves.
Las altas, resultados, asistencias y PDFs se escriben únicamente en memoria sintética.
Los resultados persistidos contienen métricas agregadas, no información real de personas.
La configuración `PUBLIC_REGISTRATION_ENABLED=true` existe solo en ese proceso de prueba.

No ejecutar una prueba de carga remota a partir de estos comandos. El siguiente paso es
un entorno cloud aislado con presupuesto y límites de prueba previamente definidos.
El informe especifica qué contadores comparar con Cloud Billing para calibrar el modelo.

## Iteración sugerida

1. Acordar con el club visitas/altas por mes y duración de los picos de septiembre y noviembre.
2. Editar el JSON y recalcular sin volver a medir el código.
3. Para comparar un cambio de implementación, conservar los JSON actuales, cambiar el
   código y repetir las dos mediciones con el mismo conjunto de datos y parámetros.
4. Comparar llamadas y bytes, pero también errores, permisos y consistencia.
5. Calibrar tarifas/tiempos con métricas de cloud antes de fijar una oferta contractual.

Se ha corregido el orden numérico de `FakeSqlConnect` para poder leer fragmentos PDF
con ordinal 0..19 en orden numérico, en lugar de 0,1,10,11... Es un cambio del simulador,
no del backend desplegado.
