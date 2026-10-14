import { buildEmployeeRanking } from './employee-ranking';

describe('buildEmployeeRanking', () => {
  const employees = [
    { id: 'e1', name: 'Ana', unitId: 'u1', unit: { id: 'u1', name: 'Centro' } },
    { id: 'e2', name: 'Bia', unitId: 'u2', unit: { id: 'u2', name: 'Norte' } },
  ];

  it('aggregates NPS, class shares and elogios per employee', () => {
    const result = buildEmployeeRanking(
      [
        { employeeId: 'e1', npsScore: 10, sentiment: 'elogio' },
        { employeeId: 'e1', npsScore: 9, sentiment: 'elogio' },
        { employeeId: 'e1', npsScore: 7, sentiment: null },
        { employeeId: 'e1', npsScore: 3, sentiment: 'reclamacao' },
        { employeeId: 'e2', npsScore: 2, sentiment: 'reclamacao' },
        { employeeId: null, npsScore: 10, sentiment: 'elogio' },
        { employeeId: 'ghost', npsScore: 10, sentiment: 'elogio' },
      ],
      employees,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      employeeId: 'e1',
      name: 'Ana',
      unitId: 'u1',
      unitName: 'Centro',
      responses: 4,
      promotersPct: 50,
      passivesPct: 25,
      detractorsPct: 25,
      nps: 25,
      elogiosPct: 67,
    });
    expect(result[1].employeeId).toBe('e2');
    expect(result[1].nps).toBe(-100);
    expect(result[1].elogiosPct).toBe(0);
  });

  it('returns nulls when there are no scores or sentiments', () => {
    const [item] = buildEmployeeRanking(
      [{ employeeId: 'e1', npsScore: null, sentiment: null }],
      employees,
    );
    expect(item.nps).toBeNull();
    expect(item.promotersPct).toBeNull();
    expect(item.elogiosPct).toBeNull();
    expect(item.responses).toBe(1);
  });
});
