import { describe, expect, it } from 'vitest';
import { parseParticipants } from './registration';

describe('the names an audience member types', () => {
	it('reads one name as one Participant', () => {
		expect(parseParticipants('Ada Lovelace')).toEqual(['Ada Lovelace']);
	});

	it('reads a group of any size as one Entry of many Participants', () => {
		const names = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Barbara Liskov'];

		expect(parseParticipants(names.join('\n'))).toEqual(names);
		expect(parseParticipants(names.join(', '))).toEqual(names);
	});

	it('accepts commas and newlines as separators', () => {
		expect(parseParticipants('Ada, Alan, Grace')).toEqual(['Ada', 'Alan', 'Grace']);
		expect(parseParticipants('Ada\n\nAlan,  Grace ')).toEqual(['Ada', 'Alan', 'Grace']);
	});

	it('collapses the whitespace a phone keyboard leaves behind', () => {
		expect(parseParticipants('  Ada   Lovelace  ')).toEqual(['Ada Lovelace']);
	});

	it('keeps two people who share a name, rather than quietly dropping one', () => {
		expect(parseParticipants('Alex\nAlex')).toEqual(['Alex', 'Alex']);
	});

	it('treats an empty field as nobody rather than as one blank Participant', () => {
		expect(parseParticipants('')).toEqual([]);
		expect(parseParticipants('  \n , \n')).toEqual([]);
	});
});
