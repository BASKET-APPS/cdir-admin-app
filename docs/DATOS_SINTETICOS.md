# Datos sintéticos para pruebas y mediciones

Generador: `tests/support/synthetic-club.ts`. Es determinista (misma semilla → mismos datos) y no contiene identidades reales: los nombres son combinaciones de nombres y apellidos de prueba ("Ejemplo", "Ficticio"…), los correos son `@example.invalid` y los IBAN y documentos son cadenas `enc:xxx` sin valor. **Todos los volúmenes son inventados.** No proceden de la base real.

Fecha de referencia de las pruebas: 2 de noviembre de 2026, 12:00 UTC (temporada 2026/2027 en curso).

## Escenario base (`BASE`)

| Concepto | Valor |
|---|---|
| Temporadas | 3 (2024/25 y 2025/26 cerradas; 2026/27 abierta y actual) |
| Equipos por temporada | 20: 17 masculinos y 3 femeninos (60 en total) |
| Jugadores | 211: 181 menores y 30 adultos; alrededor de un 3 % de los menores, de baja |
| Familias con menores | 160 (hay hermanos que comparten responsables) |
| Responsables | 301 (88 % de las familias con dos, el resto con uno) |
| Personal | 33 cuentas: 6 administradores, 24 entrenadores y 3 psicólogos |
| Solapamientos | 4 administradores también entrenan; 3 jugadores adultos son también entrenadores, y uno de ellos es además administrador (mismo correo, una sola identidad) |
| Preparación física | 2 entrenadores también tienen esa función |
| Entrenamientos | 2 por semana y equipo durante 34 semanas → 4.080; un 3 % cancelados |
| Asistencia | El 80 % de las sesiones pasadas, con todo el equipo → 21.615 filas |
| Partidos | 24 por equipo y temporada → 1.440, con resultado si se han jugado y la categoría puntúa |
| Solicitudes de jugadores | 102 (de entrenamiento y de partido), con 116 jugadores asignados y 80 subidas |
| Sesiones de apoyo | 510 (preparación física y psicología), 1.616 participantes y 1.184 asistencias |
| Notificaciones / auditoría | 1.038 / 22.551 (cada asistencia y cada resultado quedan auditados) |
| Otros | 15 eventos, 120 inscripciones, 1.725 cuotas, 106 cuentas bancarias, 60 documentos, 6 revistas, 15 fotos de perfil subidas (~20 kB) |

Tamaño aproximado en JSON: 12,6 MB.

## Escenario de crecimiento (`GROWTH`)

5 temporadas, 30 equipos (25 masculinos y 5 femeninos), 320 jugadores (275 menores y 45 adultos), 240 familias y 452 responsables, y 48 cuentas de personal. Resultado: 10.200 entrenamientos, 66.895 asistencias, 3.600 partidos y 69.595 registros de auditoría. Tamaño aproximado en JSON: 35 MB.

## Uso

- Pruebas: `npm test` (las pruebas con el simulador usan el escenario base).
- Mediciones: `npx vitest run --config vitest.bench.config.ts` (`BENCH_SCALE=growth` para el escenario de crecimiento). Resultados en `tests/bench/out-*.json`.
