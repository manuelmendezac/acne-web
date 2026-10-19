import { redirect } from 'next/navigation';

/**
 * The root of the site is the sign-in screen.
 *
 * There used to be a presentation page here with two doors — the staff portals and a patient app.
 * The patient app is gone (patients never operate the system on their own; a technician or the
 * dermatologist does, including the phone capture), and a clinical tool has exactly one entrance.
 * The login redirects each role to its own portal, so nothing is lost by skipping a landing.
 */
export default function RootPage(): never {
  redirect('/login');
}
