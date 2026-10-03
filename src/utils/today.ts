// YYYY-MM-DD in the viewer's local timezone -- directly comparable against
// a `date`-column value like FinancialTask.dueDate (also YYYY-MM-DD)
// without the UTC/local mismatch `new Date().toISOString().slice(0, 10)`
// would introduce for viewers behind a negative UTC offset in the evening.
export const todayDateString = () => new Date().toLocaleDateString('en-CA');
