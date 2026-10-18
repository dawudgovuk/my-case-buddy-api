/** Rendered email content. */
export interface EmailContent {
  subject: string;
  text?: string;
  html: string;
}

/** Every email is a template that turns typed data into content (polymorphic `render`). */
export interface EmailTemplate<TData> {
  render(data: TData): EmailContent;
}
