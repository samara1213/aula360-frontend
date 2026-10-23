import type { StudentGradebook } from '@/api/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnrollmentBadge } from '@/features/academic/enrollment-badge';
import { formatDay, formatPercent, formatScore } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AverageScore, FinalScore, GradeCell, GradesLegend } from './grades';

/**
 * Notas de un estudiante en un año: el resumen (materias × periodos, con la
 * nota anual) y una pestaña por periodo con el detalle de sus evaluaciones.
 * Lo usan «Mis notas» y la ficha del estudiante.
 */
export function StudentGrades({ data }: { data: StudentGradebook }) {
  const { scale, periods, subjects } = data;
  const periodAverage = (periodId: string) =>
    data.periodAverages.find((p) => p.periodId === periodId)?.average ?? null;

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Curso</dt>
          <dd className="font-bold">{data.course.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Año lectivo</dt>
          <dd className="font-bold">{data.academicYear.year}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Matrícula</dt>
          <dd>
            <EnrollmentBadge status={data.enrollmentStatus} />
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Promedio del año</dt>
          <dd>
            <AverageScore value={data.yearAverage} scale={scale} />
          </dd>
        </div>
      </dl>
      <GradesLegend scale={scale} />

      {subjects.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-rule px-6 py-8 text-center font-bold">
          Todavía no hay materias con notas para mostrar.
        </p>
      ) : (
        <Tabs defaultValue="year">
          <TabsList aria-label="Periodos">
            <TabsTrigger value="year">Año completo</TabsTrigger>
            {periods.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="year">
            {/* Desde tablet, tabla (si no cabe, se desplaza ella y no la página); en celular, una tarjeta por materia. */}
            <div
              role="region"
              aria-label="Resumen del año"
              tabIndex={0}
              className="relative hidden overflow-x-auto rounded-2xl border border-border bg-card outline-none focus-visible:ring-4 focus-visible:ring-ring/25 md:block"
            >
              <table className="w-full min-w-max border-separate border-spacing-0">
                <caption className="sr-only">
                  Notas de {data.student.firstName} {data.student.lastName} en{' '}
                  {data.academicYear.year}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={HEAD}>
                      Materia
                    </th>
                    {periods.map((p) => (
                      <th key={p.id} scope="col" className={HEAD}>
                        {p.name}
                      </th>
                    ))}
                    <th scope="col" className={HEAD}>
                      Nota del año
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.id}>
                      <th scope="row" className={cn(CELL, 'font-bold')}>
                        {subject.name}
                      </th>
                      {periods.map((p) => (
                        <td key={p.id} className={CELL}>
                          <GradeCell grade={subject.periods.find((g) => g.periodId === p.id)} />
                        </td>
                      ))}
                      <td className={CELL}>
                        {subject.yearFinal == null ? (
                          <span className="text-sm text-muted-foreground">Pendiente</span>
                        ) : (
                          <FinalScore
                            value={subject.yearFinal}
                            passed={subject.yearPassed ?? null}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className={cn(CELL, 'font-bold')}>
                      Promedio
                    </th>
                    {periods.map((p) => (
                      <td key={p.id} className={CELL}>
                        <AverageScore value={periodAverage(p.id)} scale={scale} />
                      </td>
                    ))}
                    <td className={CELL}>
                      <AverageScore value={data.yearAverage} scale={scale} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul aria-label="Resumen del año" className="flex flex-col gap-3 md:hidden">
              {subjects.map((subject) => (
                <li key={subject.id} className="rounded-2xl border border-border bg-card p-4">
                  <span className="font-bold break-words">{subject.name}</span>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
                    {periods.map((p) => (
                      <div key={p.id} className="contents">
                        <dt className="min-w-0 break-words text-muted-foreground">{p.name}</dt>
                        <dd className="text-right">
                          <GradeCell grade={subject.periods.find((g) => g.periodId === p.id)} />
                        </dd>
                      </div>
                    ))}
                    <div className="contents">
                      <dt className="font-bold">Nota del año</dt>
                      <dd className="text-right">
                        {subject.yearFinal == null ? (
                          <span className="text-muted-foreground">Pendiente</span>
                        ) : (
                          <FinalScore
                            value={subject.yearFinal}
                            passed={subject.yearPassed ?? null}
                          />
                        )}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
              <li className="rounded-2xl border border-border bg-card p-4">
                <span className="font-bold">Promedio</span>
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
                  {periods.map((p) => (
                    <div key={p.id} className="contents">
                      <dt className="min-w-0 break-words text-muted-foreground">{p.name}</dt>
                      <dd className="text-right">
                        <AverageScore value={periodAverage(p.id)} scale={scale} />
                      </dd>
                    </div>
                  ))}
                  <div className="contents">
                    <dt className="font-bold">Del año</dt>
                    <dd className="text-right">
                      <AverageScore value={data.yearAverage} scale={scale} />
                    </dd>
                  </div>
                </dl>
              </li>
            </ul>
          </TabsContent>

          {periods.map((p) => (
            <TabsContent key={p.id} value={p.id} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Del {formatDay(p.startDate)} al {formatDay(p.endDate)}. Promedio del periodo:{' '}
                <AverageScore value={periodAverage(p.id)} scale={scale} />
              </p>
              {subjects.map((subject) => {
                const grade = subject.periods.find((g) => g.periodId === p.id);
                return (
                  <details
                    key={subject.id}
                    className="group rounded-2xl border border-border bg-card open:pb-2"
                  >
                    <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl px-4 py-3 outline-none focus-visible:ring-4 focus-visible:ring-ring/25 [&::-webkit-details-marker]:hidden">
                      <span className="font-bold break-words">{subject.name}</span>
                      <GradeCell grade={grade} />
                    </summary>
                    {grade && grade.evaluations.length > 0 ? (
                      <ul className="flex flex-col divide-y divide-border px-4">
                        {grade.evaluations.map((e) => (
                          <li
                            key={e.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                          >
                            <span className="min-w-0 break-words">
                              {e.title}
                              <span className="block text-sm text-muted-foreground">
                                {formatPercent(e.percentage)} · {formatDay(e.evaluationDate)}
                              </span>
                            </span>
                            <span className="tabular-nums">
                              {e.score === null ? (
                                <span className="text-sm text-muted-foreground">Sin nota</span>
                              ) : (
                                formatScore(e.score)
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 pb-2 text-sm text-muted-foreground">
                        Sin evaluaciones en este periodo.
                      </p>
                    )}
                  </details>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

const HEAD =
  'border-b border-rule bg-muted/60 px-4 py-3 text-left text-sm font-bold whitespace-nowrap text-muted-foreground';
const CELL = 'border-b border-border px-4 py-3 text-left align-top';
