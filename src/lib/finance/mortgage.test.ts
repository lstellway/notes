import { describe, expect, it } from "vitest";
import {
	amortizationSchedule,
	calculateMortgage,
	LIMITS,
	type MortgageInput,
	MortgageInputError,
	monthlyPayment,
	payoffDate,
	validateMortgageInput,
	yearlySummary,
} from "./mortgage";

/*
 * Expected values come from the standard formula M = P·r(1+r)^n / ((1+r)^n − 1),
 * evaluated independently with Python's `decimal` module at 50 digits of
 * precision. Total interest without extra payments is M·n − P. Schedules with
 * extra payments were simulated the same way, month by month, in `decimal`.
 * The payments also match widely published values (e.g. $300,000 at 6% for 30
 * years is $1,798.65).
 */
const cents = (value: number) => Math.round(value * 100) / 100;

function input(overrides: Partial<MortgageInput> = {}): MortgageInput {
	return {
		homePrice: 400_000,
		downPayment: 80_000,
		annualRatePercent: 6.5,
		termMonths: 360,
		...overrides,
	};
}

describe("monthlyPayment", () => {
	it.each([
		// [loan, annual rate %, months, expected payment (full precision, from decimal)]
		[300_000, 6, 360, 1798.651575],
		[200_000, 4.5, 360, 1013.37062],
		[100_000, 5, 180, 790.793627],
		[320_000, 6.5, 360, 2022.617675],
		[320_000, 6.5, 180, 2787.543569],
	])("$%d at %d%% for %d months is %d", (loan, rate, months, expected) => {
		expect(monthlyPayment(loan, rate, months)).toBeCloseTo(expected, 5);
	});

	it("divides the loan evenly at a 0% rate", () => {
		expect(monthlyPayment(120_000, 0, 360)).toBeCloseTo(333.333333, 5);
	});

	it("is 0 for a $0 loan", () => {
		expect(monthlyPayment(0, 6, 360)).toBe(0);
	});

	it("equals the loan plus one month of interest for a 1-month term", () => {
		expect(monthlyPayment(1_000, 12, 1)).toBeCloseTo(1_010, 9);
	});
});

describe("amortizationSchedule", () => {
	it("splits the first payment into one month of interest and the rest principal", () => {
		const [first] = amortizationSchedule(300_000, 6, 360);
		// 300,000 × 0.06 / 12 = 1,500 interest; 1,798.651575 − 1,500 = 298.651575 principal.
		expect(first?.interest).toBeCloseTo(1500, 9);
		expect(first?.principal).toBeCloseTo(298.651575, 5);
	});

	it.each([
		[300_000, 6, 360],
		[320_000, 6.5, 180],
		[123_456.78, 7.125, 240],
		[120_000, 0, 360],
	])("pays $%d at %d%% down to exactly 0 in %d payments", (loan, rate, months) => {
		const schedule = amortizationSchedule(loan, rate, months);
		expect(schedule).toHaveLength(months);
		expect(schedule.at(-1)?.balance).toBe(0);
		const principal = schedule.reduce((sum, row) => sum + row.principal, 0);
		expect(principal).toBeCloseTo(loan, 6);
	});

	it("keeps every regular payment equal to the scheduled payment, except a near-equal last one", () => {
		const payment = monthlyPayment(200_000, 4.5, 360);
		const schedule = amortizationSchedule(200_000, 4.5, 360);
		for (const row of schedule) {
			expect(row.principal + row.interest).toBeCloseTo(payment, 6);
		}
	});

	it("has no rows for a $0 loan", () => {
		expect(amortizationSchedule(0, 6, 360)).toEqual([]);
	});
});

describe("calculateMortgage", () => {
	it("computes the worked example from the mortgage payments article", () => {
		const result = calculateMortgage(
			input({ costs: { propertyTax: 400, homeInsurance: 150, pmi: 0, hoa: 0 } }),
		);
		expect(result.loanAmount).toBe(320_000);
		expect(result.downPaymentPercent).toBe(20);
		expect(cents(result.principalAndInterest)).toBe(2022.62);
		expect(cents(result.totalMonthlyPayment)).toBe(2572.62);
		// 2,022.617675 × 360 − 320,000 = 408,142.36
		expect(cents(result.totalInterest)).toBe(408_142.36);
		expect(cents(result.totalPaid)).toBe(728_142.36);
		expect(result.payoffMonths).toBe(360);
		expect(result.interestSaved).toBe(0);
		expect(result.monthsSaved).toBe(0);
	});

	it.each([
		// [loan, rate, months, expected total interest]
		[300_000, 6, 360, 347_514.57],
		[200_000, 4.5, 360, 164_813.42],
		[100_000, 5, 180, 42_342.85],
		[320_000, 6.5, 180, 181_757.84],
		[320_000, 5.5, 360, 334_092.93],
		[320_000, 7.5, 360, 485_495.11],
	])("$%d at %d%% for %d months has $%d total interest", (loan, rate, months, expected) => {
		const result = calculateMortgage(
			input({ homePrice: loan, downPayment: 0, annualRatePercent: rate, termMonths: months }),
		);
		expect(cents(result.totalInterest)).toBe(expected);
	});

	it("matches the closed form M·n − P for total interest", () => {
		const result = calculateMortgage(input({ annualRatePercent: 7.25, termMonths: 240 }));
		expect(result.totalInterest).toBeCloseTo(result.principalAndInterest * 240 - 320_000, 6);
	});

	it("charges no interest at 0%", () => {
		const result = calculateMortgage(
			input({ homePrice: 120_000, downPayment: 0, annualRatePercent: 0 }),
		);
		expect(result.totalInterest).toBe(0);
		expect(result.principalAndInterest).toBeCloseTo(333.333333, 5);
		expect(result.schedule.at(-1)?.balance).toBe(0);
	});

	it("adds every monthly cost to the total payment", () => {
		const result = calculateMortgage(
			input({ costs: { propertyTax: 300, homeInsurance: 125.5, pmi: 80, hoa: 45 } }),
		);
		expect(result.totalMonthlyPayment).toBeCloseTo(result.principalAndInterest + 550.5, 9);
		expect(result.costs).toEqual({ propertyTax: 300, homeInsurance: 125.5, pmi: 80, hoa: 45 });
	});

	it("treats missing costs as 0", () => {
		const result = calculateMortgage(input({ costs: { hoa: 50 } }));
		expect(result.costs).toEqual({ propertyTax: 0, homeInsurance: 0, pmi: 0, hoa: 50 });
		expect(result.totalMonthlyPayment).toBeCloseTo(result.principalAndInterest + 50, 9);
	});

	it("handles a $0 loan (paid in full)", () => {
		const result = calculateMortgage(input({ downPayment: 400_000 }));
		expect(result.loanAmount).toBe(0);
		expect(result.principalAndInterest).toBe(0);
		expect(result.totalInterest).toBe(0);
		expect(result.payoffMonths).toBe(0);
	});

	describe("extra principal", () => {
		it("shortens the loan and saves interest by the simulated amounts", () => {
			// Simulated in decimal: $320,000 at 6.5% with $200/month extra pays off
			// in 281 payments with $302,713.69 interest.
			const result = calculateMortgage(input({ extraMonthlyPrincipal: 200 }));
			expect(result.payoffMonths).toBe(281);
			expect(cents(result.totalInterest)).toBe(302_713.69);
			expect(result.monthsSaved).toBe(79);
			expect(cents(result.interestSaved)).toBe(105_428.67);
			expect(result.withoutExtra.payoffMonths).toBe(360);
			expect(result.schedule.at(-1)?.balance).toBe(0);
		});

		it("matches a second simulated case", () => {
			// $300,000 at 6% with $100/month extra: 313 payments, $294,168.16 interest.
			const result = calculateMortgage(
				input({
					homePrice: 300_000,
					downPayment: 0,
					annualRatePercent: 6,
					extraMonthlyPrincipal: 100,
				}),
			);
			expect(result.payoffMonths).toBe(313);
			expect(cents(result.totalInterest)).toBe(294_168.16);
		});

		it("never pays more principal than the balance", () => {
			const result = calculateMortgage(input({ extraMonthlyPrincipal: 1_000_000 }));
			expect(result.payoffMonths).toBe(1);
			const [only] = result.schedule;
			expect((only?.principal ?? 0) + (only?.extraPrincipal ?? 0)).toBeCloseTo(320_000, 9);
			expect(only?.balance).toBe(0);
		});

		it("does not change the scheduled payment or total monthly payment", () => {
			const base = calculateMortgage(input());
			const extra = calculateMortgage(input({ extraMonthlyPrincipal: 500 }));
			expect(extra.principalAndInterest).toBe(base.principalAndInterest);
			expect(extra.totalMonthlyPayment).toBe(base.totalMonthlyPayment);
		});

		it("works at 0%", () => {
			// 120,000 / (333.33 + 166.67) = 240 payments.
			const result = calculateMortgage(
				input({
					homePrice: 120_000,
					downPayment: 0,
					annualRatePercent: 0,
					extraMonthlyPrincipal: 120_000 / 360 / 2,
				}),
			);
			expect(result.payoffMonths).toBe(240);
			expect(result.totalInterest).toBe(0);
			expect(result.interestSaved).toBe(0);
		});
	});

	it("throws MortgageInputError listing every problem", () => {
		try {
			calculateMortgage(input({ homePrice: -1, termMonths: 0 }));
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(MortgageInputError);
			const fields = (error as MortgageInputError).problems.map((p) => p.field);
			expect(fields).toEqual(["homePrice", "termMonths"]);
		}
	});
});

describe("validateMortgageInput", () => {
	it("accepts a valid input", () => {
		expect(validateMortgageInput(input({ extraMonthlyPrincipal: 0, costs: { pmi: 0 } }))).toEqual(
			[],
		);
	});

	it.each<[string, Partial<MortgageInput>, string]>([
		["a negative home price", { homePrice: -1 }, "homePrice"],
		["a NaN home price", { homePrice: Number.NaN }, "homePrice"],
		["an infinite home price", { homePrice: Number.POSITIVE_INFINITY }, "homePrice"],
		["a negative down payment", { downPayment: -5 }, "downPayment"],
		["a down payment above the price", { downPayment: 400_001 }, "downPayment"],
		["a negative rate", { annualRatePercent: -0.1 }, "annualRatePercent"],
		[
			"a rate above the limit",
			{ annualRatePercent: LIMITS.maxAnnualRatePercent + 1 },
			"annualRatePercent",
		],
		["a zero term", { termMonths: 0 }, "termMonths"],
		["a negative term", { termMonths: -12 }, "termMonths"],
		["a fractional term", { termMonths: 12.5 }, "termMonths"],
		["a term above the limit", { termMonths: LIMITS.maxTermMonths + 1 }, "termMonths"],
		["a negative extra payment", { extraMonthlyPrincipal: -1 }, "extraMonthlyPrincipal"],
		["a negative cost", { costs: { hoa: -1 } }, "costs.hoa"],
		["a NaN cost", { costs: { propertyTax: Number.NaN } }, "costs.propertyTax"],
	])("rejects %s", (_, overrides, field) => {
		expect(validateMortgageInput(input(overrides)).map((p) => p.field)).toEqual([field]);
	});
});

describe("yearlySummary", () => {
	it("groups payments into years that add up to the schedule", () => {
		const result = calculateMortgage(input({ extraMonthlyPrincipal: 200 }));
		const years = yearlySummary(result.schedule);
		// 281 payments = 23 full years + 5 payments.
		expect(years).toHaveLength(24);
		expect(years.map((y) => y.year)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
		expect(years.reduce((sum, y) => sum + y.interest, 0)).toBeCloseTo(result.totalInterest, 6);
		expect(years.reduce((sum, y) => sum + y.principal, 0)).toBeCloseTo(320_000, 6);
		expect(years.at(-1)?.endingBalance).toBe(0);
		expect(years[0]?.endingBalance).toBe(result.schedule[11]?.balance);
	});

	it("is empty for an empty schedule", () => {
		expect(yearlySummary([])).toEqual([]);
	});
});

describe("payoffDate", () => {
	it.each([
		[{ year: 2026, month: 11 }, 1, { year: 2026, month: 11 }],
		[{ year: 2026, month: 11 }, 2, { year: 2026, month: 12 }],
		[{ year: 2026, month: 11 }, 3, { year: 2027, month: 1 }],
		[{ year: 2026, month: 1 }, 360, { year: 2055, month: 12 }],
		[{ year: 2026, month: 11 }, 281, { year: 2050, month: 3 }],
	])("first payment %o, %d payments → %o", (first, months, expected) => {
		expect(payoffDate(first, months)).toEqual(expected);
	});
});

describe("sanity checks across many loans", () => {
	// A small deterministic generator, so failures are reproducible.
	function* loans(count: number) {
		let seed = 42;
		const next = () => {
			seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
			return seed / 2 ** 31;
		};
		for (let i = 0; i < count; i++) {
			yield {
				loan: Math.round(next() * 2_000_000 * 100) / 100,
				rate: Math.round(next() * 15 * 1000) / 1000,
				months: [60, 120, 180, 240, 360, 480][Math.floor(next() * 6)] ?? 360,
				extra: next() < 0.5 ? 0 : Math.round(next() * 2000),
			};
		}
	}

	it("pays off every loan with consistent totals", () => {
		for (const { loan, rate, months, extra } of loans(300)) {
			const label = JSON.stringify({ loan, rate, months, extra });
			const schedule = amortizationSchedule(loan, rate, months, extra);
			const payment = monthlyPayment(loan, rate, months);

			expect(schedule.length, label).toBeLessThanOrEqual(months);
			if (extra === 0 && loan > 0) expect(schedule.length, label).toBe(months);
			if (loan > 0) expect(schedule.at(-1)?.balance, label).toBe(0);

			const paid = schedule.reduce((s, r) => s + r.principal + r.extraPrincipal, 0);
			expect(Math.abs(paid - loan), label).toBeLessThan(1e-4);

			let previous = loan;
			for (const row of schedule) {
				// Balance never increases or goes negative; each payment's interest
				// is the monthly rate times the previous balance.
				expect(row.balance, label).toBeLessThanOrEqual(previous);
				expect(row.balance, label).toBeGreaterThanOrEqual(0);
				expect(row.interest, label).toBeCloseTo((previous * rate) / 1200, 6);
				expect(row.principal + row.interest, label).toBeLessThanOrEqual(payment + 1e-6);
				previous = row.balance;
			}
		}
	});

	it("charges more interest for higher rates and longer terms", () => {
		const interest = (rate: number, months: number) =>
			calculateMortgage(
				input({ homePrice: 250_000, downPayment: 0, annualRatePercent: rate, termMonths: months }),
			).totalInterest;
		for (let rate = 1; rate <= 12; rate++) {
			expect(interest(rate + 0.5, 360)).toBeGreaterThan(interest(rate, 360));
			expect(interest(rate, 360)).toBeGreaterThan(interest(rate, 180));
		}
	});

	it("saves more interest with larger extra payments", () => {
		let previous = -1;
		for (const extra of [0, 50, 100, 250, 500, 1000]) {
			const saved = calculateMortgage(input({ extraMonthlyPrincipal: extra })).interestSaved;
			expect(saved).toBeGreaterThan(previous);
			previous = saved;
		}
	});
});
