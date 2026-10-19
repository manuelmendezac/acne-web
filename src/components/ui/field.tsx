'use client';

import { Eye, EyeOff } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

const CONTROL_CLASSES =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-400 focus:border-purple-900 focus:outline-none focus:ring-2 ' +
  'focus:ring-purple-900/20 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Wiring a `Field` passes to the control it wraps.
 *
 * `Field` takes its control as `children`, so it cannot put an id on it directly. Until this
 * existed the label rendered by `Field` pointed at nothing — the `htmlFor` prop was there but no
 * caller passed it — which left every `<Select>` in the portal unlabelled for a screen reader and
 * unclickable by its own label. Context fixes all of them at once without touching a call site.
 */
interface FieldWiring {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldWiring | null>(null);

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const messageId = `${id}-message`;
  const hasError = error != null && error !== '';
  const hasMessage = hasError || hint !== undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-900">
        {label}
        {required === true ? <span className="ml-0.5 text-red-700">*</span> : null}
      </label>
      <FieldContext.Provider
        value={{ id, describedBy: hasMessage ? messageId : undefined, invalid: hasError }}
      >
        {children}
      </FieldContext.Provider>
      {hasError ? (
        <p id={messageId} className="text-xs text-red-700">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={messageId} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The id, description and validity a surrounding `Field` provides.
 *
 * Anything the caller passes explicitly wins: a control used outside a `Field`, or one given its
 * own id, must keep behaving exactly as before.
 */
function useFieldWiring(props: {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
}): {
  id: string | undefined;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean | 'true' | 'false' | 'grammar' | 'spelling' | undefined;
} {
  const field = useContext(FieldContext);
  return {
    id: props.id ?? field?.id,
    'aria-describedby': props['aria-describedby'] ?? field?.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (field?.invalid === true ? true : undefined),
  };
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    const wiring = useFieldWiring(props);
    return <input ref={ref} className={cn(CONTROL_CLASSES, className)} {...props} {...wiring} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    const wiring = useFieldWiring(props);
    return (
      <textarea
        ref={ref}
        className={cn(CONTROL_CLASSES, 'min-h-24', className)}
        {...props}
        {...wiring}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    const wiring = useFieldWiring(props);
    return (
      <select ref={ref} className={cn(CONTROL_CLASSES, 'pr-8', className)} {...props} {...wiring}>
        {children}
      </select>
    );
  },
);

/** Input plus its label, wired by a generated id. */
export function LabelledInput({
  label,
  hint,
  error,
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <Input id={id} required={required} {...props} />
    </Field>
  );
}

/**
 * Password field with a reveal control.
 *
 * The eye is a `button`, never a checkbox with an icon: it performs an action rather than recording
 * a value, and a screen reader has to hear which of the two states it is in — hence `aria-pressed`
 * and a label that changes with it.
 *
 * The field always starts hidden and never remembers the choice. Someone signing in at a reception
 * desk with a queue behind them should not have their password on screen because they revealed it
 * once, last week, on their own machine.
 */
export function PasswordInput({
  label,
  hint,
  error,
  required,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          // `pr-11` keeps the text from running under the button; without it a long password
          // disappears behind the eye exactly when the user wants to check it.
          className={cn('pr-11', className)}
          type={visible ? 'text' : 'password'}
          required={required}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          // `tabIndex={-1}` on purpose: tabbing out of the password field should reach the submit
          // button, which is what someone typing their credentials expects next.
          tabIndex={-1}
          className={cn(
            'absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md',
            'text-neutral-500 transition-colors hover:text-neutral-900',
            '',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-900',
          )}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
          <span className="sr-only">
            {visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          </span>
        </button>
      </div>
    </Field>
  );
}

// --- Choice controls ---------------------------------------------------------
// Written now because the anamnesis needs them in 15 of its 21 questions. Before this the portal
// styled raw `<input type="checkbox">` inline at each call site, which is how the consent box and
// the Likert scale ended up looking subtly different from one another.

const CHECK_CLASSES =
  'h-4 w-4 shrink-0 rounded border-neutral-300 text-purple-900 ' +
  'focus:ring-purple-900 disabled:cursor-not-allowed disabled:opacity-60';

export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }>(
  function Checkbox({ label, className, ...props }, ref) {
    return (
      <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-900">
        <input ref={ref} type="checkbox" className={cn(CHECK_CLASSES, 'mt-0.5', className)} {...props} />
        <span>{label}</span>
      </label>
    );
  },
);

export interface ChoiceOption {
  value: string;
  label: ReactNode;
}

/**
 * Single choice as a row of buttons rather than radios.
 *
 * The intake is done on a laptop at reception with the patient waiting, so the options need to be
 * large targets that show the selection at a glance. `role="radiogroup"` keeps that legible to a
 * screen reader, and arrow keys still move between the options because they are real buttons.
 */
export function RadioGroup({
  name,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  name: string;
  value: string | null;
  options: readonly ChoiceOption[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            // Clicking the selected option clears it: "no answer" is clinically different from any
            // of the answers, and without this the first accidental click would be permanent.
            onClick={() => onChange(selected ? null : option.value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              selected
                ? 'border-purple-900 bg-purple-50 font-medium text-purple-900'
                : 'border-neutral-200 text-neutral-500 hover:border-purple-900',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multiple choice over the same buttons, so both kinds of question read identically. */
export function CheckboxGroup({
  name,
  values,
  options,
  onChange,
  disabled,
  className,
}: {
  name: string;
  values: readonly string[];
  options: readonly ChoiceOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={name} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const selected = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() =>
              onChange(
                selected
                  ? values.filter((v) => v !== option.value)
                  : [...values.filter((v) => v !== option.value), option.value],
              )
            }
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              selected
                ? 'border-purple-900 bg-purple-50 font-medium text-purple-900'
                : 'border-neutral-200 text-neutral-500 hover:border-purple-900',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
