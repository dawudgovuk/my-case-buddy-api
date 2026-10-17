/**
 * Shared, email-client-safe layout for every My Case Buddy email.
 * Table-based, inline styles only, 600px wide, with solid-colour fallbacks for clients
 * (Outlook) that ignore gradients. Presentation only — callers decide content and recipients.
 */

export type EmailTone = 'brand' | 'success' | 'warning';

const TONES: Record<EmailTone, { solid: string; gradient: string; soft: string; text: string; border: string }> = {
  brand: { solid: '#2b4acb', gradient: 'linear-gradient(135deg,#1e2f86 0%,#2b4acb 55%,#4b5fe0 100%)', soft: '#eef2ff', text: '#1e2f86', border: '#c9d4fb' },
  success: { solid: '#0e7a55', gradient: 'linear-gradient(135deg,#0a5c40 0%,#0e7a55 55%,#23a07a 100%)', soft: '#e9f8f1', text: '#0a5c40', border: '#b6e7d2' },
  warning: { solid: '#b7791f', gradient: 'linear-gradient(135deg,#8a5a12 0%,#b7791f 55%,#d9a441 100%)', soft: '#fff7e8', text: '#7a4708', border: '#f8d9a0' },
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escapes user-supplied text for safe interpolation into email HTML. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:24px;color:#334155;">${html}</p>`;
}

export function heading(text: string): string {
  return `<h2 style="margin:0 0 12px 0;font-family:${FONT};font-size:20px;line-height:28px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">${text}</h2>`;
}

export function sectionLabel(text: string): string {
  return `<div style="margin:0 0 8px 0;font-family:${FONT};font-size:11px;line-height:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${text}</div>`;
}

/** A soft pill such as "Action required". */
export function pill(text: string, tone: EmailTone = 'brand'): string {
  const t = TONES[tone];
  return `<span style="display:inline-block;margin:0 0 14px 0;padding:5px 12px;border-radius:999px;background-color:${t.soft};border:1px solid ${t.border};font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;color:${t.text};">${text}</span>`;
}

/** A bulletproof button (works in Outlook via a padded table cell). */
export function button(url: string, label: string, tone: EmailTone = 'brand'): string {
  const t = TONES[tone];
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:24px auto;">
  <tr>
    <td align="center" bgcolor="${t.solid}" style="border-radius:12px;background-color:${t.solid};">
      <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${label}&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`;
}

/** Plain link fallback under a button. */
export function linkFallback(url: string): string {
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
  <tr>
    <td style="padding:12px 14px;border-radius:10px;background-color:#f8fafc;border:1px solid #e3e8f0;font-family:${FONT};font-size:12px;line-height:18px;color:#64748b;">
      Button not working? Copy this link into your browser:<br />
      <a href="${esc(url)}" target="_blank" style="color:#2b4acb;word-break:break-all;">${esc(url)}</a>
    </td>
  </tr>
</table>`;
}

/** A card of label/value rows. Values are escaped unless `html: true`. */
export function detailsCard(title: string, rows: Array<{ label: string; value: string; html?: boolean }>): string {
  const body = rows
    .filter((r) => r.value !== undefined && r.value !== null && r.value !== '')
    .map(
      (r, i) => `<tr>
        <td width="38%" valign="top" style="padding:${i === 0 ? '0' : '10px'} 12px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:#64748b;">${esc(r.label)}</td>
        <td valign="top" style="padding:${i === 0 ? '0' : '10px'} 0 0 0;font-family:${FONT};font-size:14px;line-height:20px;font-weight:700;color:#0f172a;">${r.html ? r.value : esc(r.value)}</td>
      </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 24px 0;border-radius:14px;background-color:#f8fafc;border:1px solid #e3e8f0;">
  <tr><td style="padding:18px 20px;">
    ${sectionLabel(title)}
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">${body}</table>
  </td></tr>
</table>`;
}

/** A highlighted quote, e.g. the litigant's own words. */
export function quote(text: string, tone: EmailTone = 'brand', label?: string): string {
  const t = TONES[tone];
  return `${label ? sectionLabel(label) : ''}<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
  <tr>
    <td width="4" bgcolor="${t.solid}" style="background-color:${t.solid};border-radius:4px 0 0 4px;"></td>
    <td style="padding:14px 18px;background-color:${t.soft};border-radius:0 10px 10px 0;font-family:${FONT};font-size:15px;line-height:24px;font-style:italic;color:${t.text};">&ldquo;${esc(text)}&rdquo;</td>
  </tr>
</table>`;
}

/** A list with tick / cross / numbered markers. Items are trusted HTML from templates. */
export function checklist(items: string[], kind: 'tick' | 'cross' | 'number' = 'tick', title?: string): string {
  const colours = { tick: { bg: '#e9f8f1', fg: '#0e7a55' }, cross: { bg: '#fdf0ee', fg: '#c0392b' }, number: { bg: '#eef2ff', fg: '#2b4acb' } }[kind];
  const rows = items
    .map(
      (item, i) => `<tr>
        <td width="30" valign="top" style="padding:0 0 10px 0;">
          <div style="width:22px;height:22px;border-radius:11px;background-color:${colours.bg};color:${colours.fg};font-family:${FONT};font-size:12px;line-height:22px;font-weight:800;text-align:center;">${kind === 'tick' ? '&#10003;' : kind === 'cross' ? '&#10005;' : i + 1}</div>
        </td>
        <td valign="top" style="padding:1px 0 10px 0;font-family:${FONT};font-size:14px;line-height:21px;color:#334155;">${item}</td>
      </tr>`
    )
    .join('');
  return `${title ? sectionLabel(title) : ''}<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0;">${rows}</table>`;
}

export function note(html: string, tone: EmailTone = 'brand'): string {
  const t = TONES[tone];
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;">
  <tr><td style="padding:14px 16px;border-radius:12px;background-color:${t.soft};border:1px solid ${t.border};font-family:${FONT};font-size:14px;line-height:21px;color:${t.text};">${html}</td></tr>
</table>`;
}

export interface EmailLayoutOptions {
  /** <title> and hidden inbox preview line. */
  title: string;
  preheader: string;
  tone?: EmailTone;
  /** Small text above the hero heading, e.g. "Peer support". */
  eyebrow: string;
  heroTitle: string;
  heroSubtitle?: string;
  /** A single character or emoji shown in the hero badge. */
  icon?: string;
  bodyHtml: string;
  /** Extra small print above the footer (escaped by the caller if needed). */
  smallPrint?: string;
  supportEmail?: string;
  footerExtra?: string;
}

export function renderEmail(o: EmailLayoutOptions): string {
  const t = TONES[o.tone || 'brand'];
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${esc(o.title)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .mcb-container { width: 100% !important; }
      .mcb-pad { padding-left: 22px !important; padding-right: 22px !important; }
      .mcb-hero-title { font-size: 22px !important; line-height: 30px !important; }
    }
    a { color: #2b4acb; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f6fb;font-size:1px;line-height:1px;">${esc(o.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f6fb" style="background-color:#f4f6fb;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="mcb-container" width="600" border="0" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;">
          <!-- Brand row -->
          <tr>
            <td style="padding:0 4px 16px 4px;font-family:${FONT};">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0"><tr>
                <td width="30" style="font-size:22px;line-height:22px;color:#f05b6a;">&#9829;</td>
                <td style="font-family:${FONT};font-size:17px;line-height:22px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">My Case <span style="color:#2b4acb;">Buddy</span></td>
              </tr></table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e3e8f0;border-radius:20px;overflow:hidden;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <!-- Hero -->
                <tr>
                  <td bgcolor="${t.solid}" class="mcb-pad" style="background-color:${t.solid};background-image:${t.gradient};border-radius:20px 20px 0 0;padding:34px 40px 30px 40px;">
                    ${o.icon ? `<div style="width:48px;height:48px;border-radius:14px;background-color:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.28);font-size:24px;line-height:48px;text-align:center;color:#ffffff;margin:0 0 16px 0;">${o.icon}</div>` : ''}
                    <div style="font-family:${FONT};font-size:12px;line-height:16px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,0.78);margin:0 0 6px 0;">${esc(o.eyebrow)}</div>
                    <h1 class="mcb-hero-title" style="margin:0;font-family:${FONT};font-size:26px;line-height:34px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${o.heroTitle}</h1>
                    ${o.heroSubtitle ? `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;line-height:22px;color:rgba(255,255,255,0.86);">${o.heroSubtitle}</p>` : ''}
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td class="mcb-pad" style="padding:32px 40px 12px 40px;">
                    ${o.bodyHtml}
                  </td>
                </tr>
                ${o.smallPrint ? `<tr><td class="mcb-pad" style="padding:0 40px 28px 40px;"><div style="border-top:1px solid #e3e8f0;padding-top:16px;font-family:${FONT};font-size:12px;line-height:18px;color:#64748b;">${o.smallPrint}</div></td></tr>` : ''}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:22px 24px 0 24px;font-family:${FONT};font-size:12px;line-height:18px;color:#7b8799;">
              <strong style="color:#475569;">Family proceedings are private.</strong> Please don't forward this email or share case details with anyone the court hasn't allowed.<br />
              ${o.footerExtra ? `${o.footerExtra}<br />` : ''}
              &copy; ${year} My Case Buddy${o.supportEmail ? ` &bull; <a href="mailto:${esc(o.supportEmail)}" style="color:#7b8799;">${esc(o.supportEmail)}</a>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
