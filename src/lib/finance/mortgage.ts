/**
 * Fixed-rate mortgage math: the monthly principal-and-interest payment, the
 * amortization schedule, and the total monthly payment with optional costs.
 *
 * Rounding: every value is computed and returned in full floating-point
 * precision. Nothing is rounded to cents here; round only when displaying.
 * Lenders round each payment and each month's interest to the cent, so their
 * statements can differ from these results by a few cents (and the final
 * payment by a little more).
 *
 * Conventions (standard for US fixed-rate mortgages):
 * - The monthly rate is the annual rate divided by 12.
 * - Payments are monthly, with the first one due one month after the loan starts.
 * - Extra principal is paid with every regular payment, starting with the first.
 */

export interface MortgageInput {
	/** Purchase price of the home, in dollars. */
	homePrice: number;
	/** Down payment, in dollars. Must not exceed the home price. */
	downPayment: number;
	/** Annual interest rate as a percentage, e.g. `6.5` for 6.5%. */
	annualRatePercent: number;
	/** Loan term in months, e.g. `360` for 30 years. */
	termMonths: number;
	/** Optional extra amount paid toward principal every month, in dollars. */
	extraMonthlyPrincipal?: number;
	/** Optional monthly costs paid alongside principal and interest. */
	costs?: MonthlyCosts;
}

/** Monthly amounts, in dollars, for costs that are not principal or interest. */
export interface MonthlyCosts {
	propertyTax?: number;
	homeInsurance?: number;
	/** Private mortgage insurance. */
	pmi?: number;
	/** Homeowners association dues. */
	hoa?: number;
}

export type MortgageField =
	| "homePrice"
	| "downPayment"
	| "annualRatePercent"
	| "termMonths"
	| "extraMonthlyPrincipal"
	| `costs.${keyof MonthlyCosts}`;

export interface InputProblem {
	field: MortgageField;
	message: string;
}

export interface AmortizationRow {
	/** Payment number, starting at 1. */
	month: number;
	/** Interest charged this month. */
	interest: number;
	/** Principal paid by the regular payment. */
	principal: number;
	/** Extra principal paid this month. */
	extraPrincipal: number;
	/** Balance after this month's payment. Exactly 0 after the final payment. */
	balance: number;
}

export interface YearSummary {
	/** Loan year, starting at 1 (payments 1–12 are year 1). */
	year: number;
	interest: number;
	/** Principal paid, including extra principal. */
	principal: number;
	/** Balance at the end of the year. */
	endingBalance: number;
}

export interface LoanTotals {
	/** Number of payments until the balance reaches zero. */
	payoffMonths: number;
	totalInterest: number;
	/** Loan amount plus total interest. */
	totalPaid: number;
}

export interface MortgageResult extends LoanTotals {
	loanAmount: number;
	/** Down payment as a percentage of the home price (0 when the price is 0). */
	downPaymentPercent: number;
	/** The scheduled monthly principal-and-interest payment. */
	principalAndInterest: number;
	/** The monthly costs used, with missing ones set to 0. */
	costs: Required<MonthlyCosts>;
	/** Principal and interest plus all monthly costs (excludes extra principal). */
	totalMonthlyPayment: number;
	extraMonthlyPrincipal: number;
	schedule: AmortizationRow[];
	/** Totals for the same loan without extra principal payments. */
	withoutExtra: LoanTotals;
	/** Interest avoided by paying extra principal (0 without extra payments). */
	interestSaved: number;
	/** Payments avoided by paying extra principal (0 without extra payments). */
	monthsSaved: number;
}

/** Upper bounds that catch typos (e.g. 65 instead of 6.5) without limiting real loans. */
export const LIMITS = {
	maxAnnualRatePercent: 50,
	maxTermMonths: 600,
} as const;

export class MortgageInputError extends Error {
	readonly problems: InputProblem[];
	constructor(problems: InputProblem[]) {
		super(`Invalid mortgage input: ${problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`);
		this.name = "MortgageInputError";
		this.problems = problems;
	}
}

/**
 * Balances below this many dollars count as paid off. Floating-point error
 * leaves a few billionths of a dollar after the last scheduled payment.
 */
const PAID_OFF_EPSILON = 1e-6;

function isNonNegative(value: number): boolean {
	return Number.isFinite(value) && value >= 0;
}

/** Returns every problem with the input. An empty list means the input is valid. */
export function validateMortgageInput(input: MortgageInput): InputProblem[] {
	const problems: InputProblem[] = [];
	const add = (field: MortgageField, message: string) => problems.push({ field, message });

	if (!isNonNegative(input.homePrice)) add("homePrice", "Enter a home price of 0 or more.");
	if (!isNonNegative(input.downPayment)) {
		add("downPayment", "Enter a down payment of 0 or more.");
	} else if (isNonNegative(input.homePrice) && input.downPayment > input.homePrice) {
		add("downPayment", "The down payment can't be more than the home price.");
	}
	if (!isNonNegative(input.annualRatePercent)) {
		add("annualRatePercent", "Enter an interest rate of 0 or more.");
	} else if (input.annualRatePercent > LIMITS.maxAnnualRatePercent) {
		add("annualRatePercent", `Enter an interest rate of ${LIMITS.maxAnnualRatePercent}% or less.`);
	}
	if (
		!Number.isInteger(input.termMonths) ||
		input.termMonths <= 0 ||
		input.termMonths > LIMITS.maxTermMonths
	) {
		add("termMonths", `Enter a term of 1 to ${LIMITS.maxTermMonths} whole months.`);
	}
	if (input.extraMonthlyPrincipal !== undefined && !isNonNegative(input.extraMonthlyPrincipal)) {
		add("extraMonthlyPrincipal", "Enter an extra payment of 0 or more.");
	}
	for (const [name, value] of Object.entries(input.costs ?? {})) {
		if (value !== undefined && !isNonNegative(value)) {
			add(`costs.${name as keyof MonthlyCosts}`, "Enter an amount of 0 or more.");
		}
	}
	return problems;
}

/**
 * The fixed monthly principal-and-interest payment:
 *
 *   M = P · r(1 + r)^n / ((1 + r)^n − 1)
 *
 * where P is the loan amount, r the monthly rate (annual rate / 12), and n the
 * number of payments. At a 0% rate the formula divides by zero, and the payment
 * is simply P / n.
 */
export function monthlyPayment(
	loanAmount: number,
	annualRatePercent: number,
	termMonths: number,
): number {
	const r = annualRatePercent / 100 / 12;
	if (r === 0) return loanAmount / termMonths;
	const growth = (1 + r) ** termMonths;
	return (loanAmount * r * growth) / (growth - 1);
}

/**
 * Builds the month-by-month schedule. The regular payment is `payment`; any
 * extra principal is added on top. The last payment is whatever clears the
 * balance, so the final balance is exactly 0.
 */
export function amortizationSchedule(
	loanAmount: number,
	annualRatePercent: number,
	termMonths: number,
	extraMonthlyPrincipal = 0,
): AmortizationRow[] {
	const r = annualRatePercent / 100 / 12;
	const payment = monthlyPayment(loanAmount, annualRatePercent, termMonths);
	const rows: AmortizationRow[] = [];
	let balance = loanAmount;

	for (let month = 1; month <= termMonths && balance > PAID_OFF_EPSILON; month++) {
		const interest = balance * r;
		// On the last scheduled payment, clear any floating-point leftover.
		const principal = month === termMonths ? balance : Math.min(payment - interest, balance);
		const extraPrincipal = Math.min(extraMonthlyPrincipal, balance - principal);
		balance -= principal + extraPrincipal;
		if (balance <= PAID_OFF_EPSILON) balance = 0;
		rows.push({ month, interest, principal, extraPrincipal, balance });
	}
	return rows;
}

function totalsOf(loanAmount: number, schedule: AmortizationRow[]): LoanTotals {
	const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
	return { payoffMonths: schedule.length, totalInterest, totalPaid: loanAmount + totalInterest };
}

/** Groups a schedule into loan years (12 payments each; the last year may be shorter). */
export function yearlySummary(schedule: AmortizationRow[]): YearSummary[] {
	const years: YearSummary[] = [];
	for (const row of schedule) {
		const year = Math.ceil(row.month / 12);
		let summary = years[year - 1];
		if (!summary) {
			summary = { year, interest: 0, principal: 0, endingBalance: 0 };
			years.push(summary);
		}
		summary.interest += row.interest;
		summary.principal += row.principal + row.extraPrincipal;
		summary.endingBalance = row.balance;
	}
	return years;
}

/**
 * Calculates the loan, schedule, and total monthly payment.
 * Throws `MortgageInputError` if the input is invalid; call
 * `validateMortgageInput` first to show problems without throwing.
 */
export function calculateMortgage(input: MortgageInput): MortgageResult {
	const problems = validateMortgageInput(input);
	if (problems.length > 0) throw new MortgageInputError(problems);

	const { homePrice, downPayment, annualRatePercent, termMonths } = input;
	const extraMonthlyPrincipal = input.extraMonthlyPrincipal ?? 0;
	const loanAmount = homePrice - downPayment;
	const costs: Required<MonthlyCosts> = {
		propertyTax: input.costs?.propertyTax ?? 0,
		homeInsurance: input.costs?.homeInsurance ?? 0,
		pmi: input.costs?.pmi ?? 0,
		hoa: input.costs?.hoa ?? 0,
	};

	const principalAndInterest = monthlyPayment(loanAmount, annualRatePercent, termMonths);
	const schedule = amortizationSchedule(
		loanAmount,
		annualRatePercent,
		termMonths,
		extraMonthlyPrincipal,
	);
	const totals = totalsOf(loanAmount, schedule);
	const withoutExtra =
		extraMonthlyPrincipal > 0
			? totalsOf(loanAmount, amortizationSchedule(loanAmount, annualRatePercent, termMonths))
			: totals;

	return {
		loanAmount,
		downPaymentPercent: homePrice > 0 ? (downPayment / homePrice) * 100 : 0,
		principalAndInterest,
		costs,
		totalMonthlyPayment:
			principalAndInterest + costs.propertyTax + costs.homeInsurance + costs.pmi + costs.hoa,
		extraMonthlyPrincipal,
		schedule,
		...totals,
		withoutExtra,
		interestSaved: withoutExtra.totalInterest - totals.totalInterest,
		monthsSaved: withoutExtra.payoffMonths - totals.payoffMonths,
	};
}

/**
 * The calendar month of the final payment, given the first payment's month.
 * `month` is 1–12.
 */
export function payoffDate(
	firstPayment: { year: number; month: number },
	payoffMonths: number,
): { year: number; month: number } {
	const index = firstPayment.year * 12 + (firstPayment.month - 1) + (payoffMonths - 1);
	return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
