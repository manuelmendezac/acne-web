'use client';

import { Field, LabelledInput, Select } from '@/components/ui/field';
import { useCatalogs } from '@/lib/use-catalogs';

export interface PatientFieldValues {
  fullName: string;
  documentId: string;
  phone: string;
  email: string;
  birthDate: string;
  sex: string;
  fitzpatrick: string;
}

/**
 * The patient's own data, controlled from outside.
 *
 * Shared by the case intake and the correction screen so the two cannot drift — the first fix to
 * a hint or a validation rule would otherwise land in one of them only.
 *
 * `identityEditable` and `documentEditable` are separate on purpose, and they mirror the server:
 *
 *  - the NAME is editable by whoever can see it (`IDENTITY_ROLES`), because correcting an accent
 *    requires reading what is there;
 *  - the DOCUMENT is narrower still — only the roles that may see a patient's identity —
 *    because that is who
 *    `GET /patients/:id/identity` answers, and it is the only route that returns it.
 *
 * An `admin` sees neither. They already type a name blind at intake; overwriting one blind is a
 * different act, because there the mistake destroys a correct value instead of creating a new one.
 */
export function PatientFields({
  values,
  onChange,
  identityEditable = true,
  documentEditable = true,
  nameRequired = true,
  nameError = null,
}: {
  values: PatientFieldValues;
  onChange: (values: PatientFieldValues) => void;
  identityEditable?: boolean;
  documentEditable?: boolean;
  nameRequired?: boolean;
  /** Shown under the name field, so the message sits where the mistake is. */
  nameError?: string | null;
}): JSX.Element {
  const { data: catalogs } = useCatalogs();

  function set<K extends keyof PatientFieldValues>(key: K, value: string): void {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-4">
      {identityEditable ? (
        <LabelledInput
          label="Nombre completo"
          required={nameRequired}
          error={nameError}
          value={values.fullName}
          onChange={(event) => set('fullName', event.target.value)}
          hint="Se guarda cifrado; solo el personal autorizado lo ve."
        />
      ) : null}

      {/*
        * El contacto va junto al nombre y se cifra igual: es por donde se le manda la receta, y
        * pedirlo en el ingreso evita teclearlo —y equivocarse— en cada envío. Va detrás de
        * `identityEditable` porque un teléfono identifica a una persona tan bien como su nombre.
        */}
      {identityEditable ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <LabelledInput
            label="Teléfono"
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(event) => set('phone', event.target.value)}
            placeholder="+51 987 654 321"
            hint="Por aquí se le envía la receta. También se cifra."
          />
          <LabelledInput
            label="Correo electrónico"
            type="email"
            value={values.email}
            onChange={(event) => set('email', event.target.value)}
            placeholder="paciente@correo.com"
            hint="Canal alterno si no usa WhatsApp."
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {documentEditable ? (
          <LabelledInput
            label="Documento de identidad"
            value={values.documentId}
            onChange={(event) => set('documentId', event.target.value)}
          />
        ) : null}

        <LabelledInput
          label="Fecha de nacimiento"
          type="date"
          value={values.birthDate}
          onChange={(event) => set('birthDate', event.target.value)}
          hint="Define si aplica el bloque hormonal de la anamnesis."
        />

        <Field label="Sexo">
          <Select value={values.sex} onChange={(event) => set('sex', event.target.value)}>
            <option value="">Sin especificar</option>
            {(catalogs?.sexes ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Fototipo Fitzpatrick" hint="Tipo de piel, del I (muy clara) al VI (muy oscura).">
          <Select
            value={values.fitzpatrick}
            onChange={(event) => set('fitzpatrick', event.target.value)}
          >
            <option value="">Sin especificar</option>
            {(catalogs?.fitzpatrick ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}
