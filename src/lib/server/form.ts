// Submitted form values, read the same way everywhere. `FormData.get` hands back
// a string, a File or null, and a field the operator left blank is empty text
// rather than a missing value.

/** One text field, trimmed. A blank field is the empty string. */
export function formText(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * One optional text field. The empty string is how a browser says "left blank",
 * which means "show nothing" rather than an empty line on screen.
 */
export function formNotice(value: FormDataEntryValue | null): string | null {
	const text = formText(value);
	return text === '' ? null : text;
}
