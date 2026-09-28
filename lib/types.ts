export type MonthKey = string; // "2026-09"

export type LineGroup =
  | "otherRevenue"
  | "practicePayroll"
  | "practiceOverhead"
  | "corporatePayroll"
  | "corporateOverhead";

export type ComputedKind = "directPay" | "ceu" | "mktNewHire" | "mktMaintenance";

export interface LineDef {
  id: string;
  name: string;
  group: LineGroup;
  computed?: ComputedKind;
  note?: string;
}

export interface Rates {
  revenuePerSession: number;
  therapistPayPerSession: number;
  execSessionsUnpaid: number; // per executive, per month
  employmentTaxRate: number;
  clientsPerNewTherapist: number;
  turnoverClientsPerTherapist: number;
  costPerNewClient: number;
  ceuPerTherapistPerYear: number;
}

export interface SessionAverages {
  fullTime: number;
  partTime: number;
  executive: number;
  newHire: number;
}

export type Role = "fullTime" | "partTime";

export interface Assumptions extends Rates {
  sessions: SessionAverages;
  newHiresJoinAs: Role;
  departuresFrom: Role;
}

export interface PlanMonth {
  hires: number;
  departures: number;
  sessionsOverride?: number | null;
  fullTime?: number | null;
  partTime?: number | null;
  executives?: number | null;
}

export interface Plan {
  assumptions: Assumptions;
  months: Record<MonthKey, PlanMonth>;
  lineValues: Record<string, Record<MonthKey, number>>;
}

export interface MonthActual {
  fullTime: number;
  partTime: number;
  executives: number;
  newHires: number;
  departures: number;
  sessions: number;
  revenue?: number | null; // null = sessions × rate + other revenue
  rates: Rates; // frozen when the month was closed
  lines: Record<string, number>;
  computedOverrides: Partial<Record<string, number>>;
  note?: string;
}

export interface Scenario {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  plan: Plan;
}

export interface AppData {
  version: 1;
  months: MonthKey[];
  lines: LineDef[];
  actuals: Record<MonthKey, MonthActual>;
  startingHeadcount: { fullTime: number; partTime: number; executives: number };
  baselineId: string;
  scenarios: Scenario[];
}

export interface MonthResult {
  month: MonthKey;
  isActual: boolean;
  fullTime: number;
  partTime: number;
  executives: number;
  newHires: number;
  departures: number;
  totalTherapists: number;
  sessions: number;
  sessionRevenue: number;
  otherRevenue: number;
  revenue: number;
  lines: Record<string, number>;
  practicePayrollPreTax: number;
  practiceTax: number;
  practicePayroll: number;
  practiceOverhead: number;
  practiceNet: number;
  corporatePayrollPreTax: number;
  corporateTax: number;
  corporatePayroll: number;
  corporateOverhead: number;
  corporateTotal: number;
  totalPayroll: number;
  totalOverhead: number;
  ebitda: number;
  margin: number;
}
