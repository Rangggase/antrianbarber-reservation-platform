/**
 * New design system (design-system/MASTER.md). Importing from here also loads the font and ui.css, so
 * pages that do not use it pay nothing (CSS is only bundled for modules that are actually imported).
 */
import '@fontsource-variable/archivo/wdth.css';
import './ui.css';

export { Button } from './Button';
export { buttonClass, type ButtonVariant } from './buttonClass';
export { TextField } from './TextField';
export { Notice, type NoticeVariant } from './Notice';
export { StatusBadge } from './StatusBadge';
export { Ticket } from './Ticket';
