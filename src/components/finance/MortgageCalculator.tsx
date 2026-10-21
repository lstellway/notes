/**
 * Interactive fixed-rate mortgage calculator (a Preact island).
 *
 * Use it through `MortgageCalculatorEmbed.astro`, which adds the hydration
 * directive and the no-JavaScript message. All math lives in
 * `src/lib/finance/mortgage.ts`; this file only handles input and display.
 */
import { useEffect, useMemo, useState } from "preact/hooks";
import {
	calculateMortgage,
	type MortgageField,
	type MortgageInput,
	type MortgageResult,
	payoffDate,
	validateMortgageInput,
	yearlySummary,
} from "../../lib/finance/mortgage";
import "./MortgageCalculator.css";

export interface MortgageCalculatorProps {
	/** Prefix for element ids. Give each calculator on a page a different one. */
	idPrefix?: string;
}

type DownPaymentMode = "amount" | "percent";

interface FormState {
	homePrice: string;
	downPaymentMode: DownPaymentMode;
	downPayment: string;
	annualRatePercent: string;
	termYears: string;
	propertyTaxYearly: string;
	homeInsuranceYearly: string;
	pmiMonthly: string;
	hoaMonthly: string;
	extraMonthlyPrincipal: string;
	/** `YYYY-MM` from a month input, or empty. */
	firstPaymentMonth: string;
}

type FormField = Exclude<keyof FormState, "downPaymentMode">;

const DEFAULTS: FormState = {
	homePrice: "400,000",
	downPaymentMode: "amount",
	downPayment: "80,000",
	annualRatePercent: "6.5",
	termYears: "30",
	propertyTaxYearly: "",
	homeInsuranceYearly: "",
	pmiMonthly: "",
	hoaMonthly: "",
	extraMonthlyPrincipal: "",
	firstPaymentMonth: "",
};

const TERM_YEARS = ["30", "20", "15"] as const;

/** Which form field shows each calculation problem. */
const FIELD_FOR_PROBLEM: Record<MortgageField, FormField> = {
	homePrice: "homePrice",
	downPayment: "downPayment",
	annualRatePercent: "annualRatePercent",
	termMonths: "termYears",
	extraMonthlyPrincipal: "extraMonthlyPrincipal",
	"costs.propertyTax": "propertyTaxYearly",
	"costs.homeInsurance": "homeInsuranceYearly",
	"costs.pmi": "pmiMonthly",
	"costs.hoa": "hoaMonthly",
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const wholeCurrency = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const monthYear = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

/** `undefined` for an empty field, `NaN` for text that isn't a number. */
function parseNumber(text: string): number | undefined {
	const cleaned = text.replace(/[\s,$%]/g, "");
	if (cleaned === "") return undefined;
	return /^\d*\.?\d*$|^-\d*\.?\d*$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

function formatDuration(months: number): string {
	const years = Math.floor(months / 12);
	const rest = months % 12;
	const parts: string[] = [];
	if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
	if (rest > 0 || years === 0) parts.push(`${rest} ${rest === 1 ? "month" : "months"}`);
	return parts.join(", ");
}

function formatPayoffDate(firstPaymentMonth: string, payoffMonths: number): string | undefined {
	const match = /^(\d{4})-(\d{2})$/.exec(firstPaymentMonth);
	if (!match || payoffMonths === 0) return undefined;
	const { year, month } = payoffDate(
		{ year: Number(match[1]), month: Number(match[2]) },
		payoffMonths,
	);
	return monthYear.format(Date.UTC(year, month - 1, 1));
}

type Outcome =
	| { ok: true; result: MortgageResult; downPaymentAmount: number }
	| { ok: false; errors: Partial<Record<FormField, string>> };

/** Turns the form's text into a calculation, or into per-field error messages. */
function evaluate(form: FormState): Outcome {
	const errors: Partial<Record<FormField, string>> = {};
	const read = (field: FormField, required: boolean): number => {
		const value = parseNumber(form[field]);
		if (value === undefined) {
			if (required) errors[field] = "Enter a number.";
			return 0;
		}
		if (Number.isNaN(value)) errors[field] = "Enter a number, like 1,250.50.";
		return value;
	};

	const homePrice = read("homePrice", true);
	const downValue = read("downPayment", true);
	const downPaymentAmount =
		form.downPaymentMode === "percent" ? (homePrice * downValue) / 100 : downValue;
	const input: MortgageInput = {
		homePrice,
		downPayment: downPaymentAmount,
		annualRatePercent: read("annualRatePercent", true),
		termMonths: Number(form.termYears) * 12,
		extraMonthlyPrincipal: read("extraMonthlyPrincipal", false),
		costs: {
			propertyTax: read("propertyTaxYearly", false) / 12,
			homeInsurance: read("homeInsuranceYearly", false) / 12,
			pmi: read("pmiMonthly", false),
			hoa: read("hoaMonthly", false),
		},
	};

	for (const problem of validateMortgageInput(input)) {
		const field = FIELD_FOR_PROBLEM[problem.field];
		let message = problem.message;
		if (field === "propertyTaxYearly" || field === "homeInsuranceYearly") {
			message = "Enter a yearly amount of 0 or more.";
		}
		errors[field] ??= message;
	}
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, result: calculateMortgage(input), downPaymentAmount };
}

interface NumberFieldProps {
	id: string;
	label: string;
	value: string;
	onInput: (value: string) => void;
	error?: string;
	hint?: string;
	/** Shown before the input, e.g. "$". */
	prefix?: string;
	/** Shown after the input, e.g. "%" or "per year". */
	suffix?: string;
}

function NumberField({ id, label, value, onInput, error, hint, prefix, suffix }: NumberFieldProps) {
	const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
	return (
		<div class="mc-field">
			<label for={id}>{label}</label>
			<div class="mc-input">
				{prefix && (
					<span class="mc-affix" aria-hidden="true">
						{prefix}
					</span>
				)}
				<input
					id={id}
					type="text"
					inputMode="decimal"
					autoComplete="off"
					spellcheck={false}
					value={value}
					onInput={(event) => onInput(event.currentTarget.value)}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy || undefined}
				/>
				{suffix && (
					<span class="mc-affix" aria-hidden="true">
						{suffix}
					</span>
				)}
			</div>
			{hint && (
				<p id={`${id}-hint`} class="mc-hint">
					{hint}
				</p>
			)}
			{error && (
				<p id={`${id}-error`} class="mc-error">
					{error}
				</p>
			)}
		</div>
	);
}

export default function MortgageCalculator({ idPrefix = "mortgage" }: MortgageCalculatorProps) {
	const [form, setForm] = useState<FormState>(DEFAULTS);
	const outcome = useMemo(() => evaluate(form), [form]);
	const id = (name: string) => `${idPrefix}-${name}`;
	const set = (field: keyof FormState) => (value: string) =>
		setForm((previous) => ({ ...previous, [field]: value }));
	const errors = outcome.ok ? {} : outcome.errors;

	// Screen readers hear the new payment once typing pauses, not on every keystroke.
	const summary = outcome.ok
		? `Estimated monthly payment: ${currency.format(outcome.result.totalMonthlyPayment)}.`
		: "Fix the highlighted fields to see results.";
	const [announcement, setAnnouncement] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setAnnouncement(summary), 700);
		return () => clearTimeout(timer);
	}, [summary]);

	const switchDownPaymentMode = (mode: DownPaymentMode) => {
		if (mode === form.downPaymentMode) return;
		const price = parseNumber(form.homePrice);
		const down = parseNumber(form.downPayment);
		let downPayment = "";
		if (price !== undefined && down !== undefined && price > 0 && Number.isFinite(down)) {
			downPayment =
				mode === "percent"
					? percent.format((down / price) * 100)
					: Math.round((price * down) / 100).toLocaleString("en-US");
		}
		setForm((previous) => ({ ...previous, downPaymentMode: mode, downPayment }));
	};

	return (
		<div class="mortgage-calculator not-content">
			<form
				class="mc-inputs"
				onSubmit={(event) => event.preventDefault()}
				aria-label="Mortgage details"
				noValidate
			>
				<NumberField
					id={id("home-price")}
					label="Home price"
					prefix="$"
					value={form.homePrice}
					onInput={set("homePrice")}
					error={errors.homePrice}
				/>

				<fieldset class="mc-fieldset">
					<legend>Down payment</legend>
					<div class="mc-toggle">
						{(["amount", "percent"] as const).map((mode) => (
							<label key={mode}>
								<input
									type="radio"
									name={id("down-mode")}
									value={mode}
									checked={form.downPaymentMode === mode}
									onChange={() => switchDownPaymentMode(mode)}
								/>
								{mode === "amount" ? "Dollar amount" : "Percent of price"}
							</label>
						))}
					</div>
					<NumberField
						id={id("down-payment")}
						label={
							form.downPaymentMode === "amount" ? "Down payment amount" : "Down payment percent"
						}
						prefix={form.downPaymentMode === "amount" ? "$" : undefined}
						suffix={form.downPaymentMode === "percent" ? "%" : undefined}
						value={form.downPayment}
						onInput={set("downPayment")}
						error={errors.downPayment}
						hint={
							outcome.ok
								? form.downPaymentMode === "amount"
									? `${percent.format(outcome.result.downPaymentPercent)}% of the price`
									: `${currency.format(outcome.downPaymentAmount)}`
								: undefined
						}
					/>
				</fieldset>

				<NumberField
					id={id("rate")}
					label="Interest rate (yearly)"
					suffix="%"
					value={form.annualRatePercent}
					onInput={set("annualRatePercent")}
					error={errors.annualRatePercent}
					hint="The note rate on the loan, not the APR."
				/>

				<div class="mc-field">
					<label for={id("term")}>Loan term</label>
					<select
						id={id("term")}
						value={form.termYears}
						onChange={(event) => set("termYears")(event.currentTarget.value)}
					>
						{TERM_YEARS.map((years) => (
							<option key={years} value={years}>
								{years} years
							</option>
						))}
					</select>
				</div>

				<details class="mc-details">
					<summary>Optional costs and extra payments</summary>
					<div class="mc-details-body">
						<NumberField
							id={id("property-tax")}
							label="Property tax"
							prefix="$"
							suffix="per year"
							value={form.propertyTaxYearly}
							onInput={set("propertyTaxYearly")}
							error={errors.propertyTaxYearly}
						/>
						<NumberField
							id={id("insurance")}
							label="Homeowners insurance"
							prefix="$"
							suffix="per year"
							value={form.homeInsuranceYearly}
							onInput={set("homeInsuranceYearly")}
							error={errors.homeInsuranceYearly}
						/>
						<NumberField
							id={id("pmi")}
							label="Private mortgage insurance (PMI)"
							prefix="$"
							suffix="per month"
							value={form.pmiMonthly}
							onInput={set("pmiMonthly")}
							error={errors.pmiMonthly}
						/>
						<NumberField
							id={id("hoa")}
							label="HOA dues"
							prefix="$"
							suffix="per month"
							value={form.hoaMonthly}
							onInput={set("hoaMonthly")}
							error={errors.hoaMonthly}
						/>
						<NumberField
							id={id("extra")}
							label="Extra payment toward principal"
							prefix="$"
							suffix="per month"
							value={form.extraMonthlyPrincipal}
							onInput={set("extraMonthlyPrincipal")}
							error={errors.extraMonthlyPrincipal}
						/>
						<div class="mc-field">
							<label for={id("first-payment")}>First payment month</label>
							<input
								id={id("first-payment")}
								type="month"
								value={form.firstPaymentMonth}
								onInput={(event) => set("firstPaymentMonth")(event.currentTarget.value)}
								aria-describedby={id("first-payment-hint")}
							/>
							<p id={id("first-payment-hint")} class="mc-hint">
								Optional. Used to show the payoff date.
							</p>
						</div>
					</div>
				</details>
			</form>

			<section class="mc-results" aria-labelledby={id("results-heading")}>
				<h2 id={id("results-heading")} class="mc-results-heading">
					Results
				</h2>
				<p class="mc-sr-only" aria-live="polite" aria-atomic="true">
					{announcement}
				</p>
				{outcome.ok ? (
					<Results
						result={outcome.result}
						payoff={formatPayoffDate(form.firstPaymentMonth, outcome.result.payoffMonths)}
						tableId={id("schedule")}
					/>
				) : (
					<p class="mc-placeholder">Fix the highlighted fields to see results.</p>
				)}
			</section>
		</div>
	);
}

interface ResultsProps {
	result: MortgageResult;
	payoff: string | undefined;
	tableId: string;
}

function Results({ result, payoff, tableId }: ResultsProps) {
	const { costs } = result;
	const breakdown: [string, number][] = [
		["Principal and interest", result.principalAndInterest],
		["Property tax", costs.propertyTax],
		["Homeowners insurance", costs.homeInsurance],
		["PMI", costs.pmi],
		["HOA dues", costs.hoa],
	];
	const shown = breakdown.filter(([label, amount]) => amount > 0 || label.startsWith("Principal"));
	const needsPmiHint = result.loanAmount > 0 && result.downPaymentPercent < 20 && costs.pmi === 0;
	const extra = result.extraMonthlyPrincipal > 0 && result.loanAmount > 0;
	const years = yearlySummary(result.schedule);

	return (
		<>
			<p class="mc-total">
				<span class="mc-total-label">Estimated monthly payment</span>
				<span class="mc-total-amount">{currency.format(result.totalMonthlyPayment)}</span>
			</p>

			<dl class="mc-list">
				{shown.map(([label, amount]) => (
					<div key={label}>
						<dt>{label}</dt>
						<dd>{currency.format(amount)}</dd>
					</div>
				))}
			</dl>

			{needsPmiHint && (
				<p class="mc-note">
					With less than 20% down, conventional loans usually require PMI. Add an estimate under
					“Optional costs” to include it.
				</p>
			)}

			<dl class="mc-list">
				<div>
					<dt>Loan amount</dt>
					<dd>{currency.format(result.loanAmount)}</dd>
				</div>
				<div>
					<dt>Total interest</dt>
					<dd>{currency.format(result.totalInterest)}</dd>
				</div>
				<div>
					<dt>Total principal and interest</dt>
					<dd>{currency.format(result.totalPaid)}</dd>
				</div>
				<div>
					<dt>Paid off in</dt>
					<dd>{formatDuration(result.payoffMonths)}</dd>
				</div>
				{payoff && (
					<div>
						<dt>Last payment</dt>
						<dd>{payoff}</dd>
					</div>
				)}
			</dl>

			{extra && (
				<p class="mc-note">
					Paying {currency.format(result.extraMonthlyPrincipal)} extra each month (
					{currency.format(result.principalAndInterest + result.extraMonthlyPrincipal)} toward the
					loan in total) pays it off{" "}
					{result.monthsSaved > 0 ? `${formatDuration(result.monthsSaved)} sooner` : "on schedule"}{" "}
					and saves {currency.format(result.interestSaved)} in interest.
				</p>
			)}

			{years.length > 0 && (
				<details class="mc-details">
					<summary>Yearly amortization summary</summary>
					{/* The table scrolls sideways on narrow screens; keyboard users need to focus it to scroll. */}
					<section
						class="mc-table-wrap"
						aria-labelledby={`${tableId}-caption`}
						// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable regions must be focusable (WCAG 2.1.1).
						tabIndex={0}
					>
						<table class="mc-table">
							<caption id={`${tableId}-caption`}>
								Interest and principal paid each loan year, rounded to the dollar
							</caption>
							<thead>
								<tr>
									<th scope="col">Year</th>
									<th scope="col">Interest</th>
									<th scope="col">Principal</th>
									<th scope="col">Balance at year end</th>
								</tr>
							</thead>
							<tbody>
								{years.map((year) => (
									<tr key={year.year}>
										<th scope="row">{year.year}</th>
										<td>{wholeCurrency.format(year.interest)}</td>
										<td>{wholeCurrency.format(year.principal)}</td>
										<td>{wholeCurrency.format(year.endingBalance)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				</details>
			)}
		</>
	);
}
