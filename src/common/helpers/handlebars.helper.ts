import * as hbs from 'hbs';

/**
 * Handlebars helper functions
 */
export class HandlebarsHelper {
  /**
   * Register all Handlebars helpers
   */
  static registerHelpers(): void {
    // JSON helper - Use triple braces {{{json data}}} in template to prevent HTML escaping
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper('json', (context: unknown) => {
      if (context === null || context === undefined) {
        return 'null';
      }

      // If it's an array, filter out null/undefined values
      if (Array.isArray(context)) {
        const filtered = context.filter(
          (item) =>
            item !== null &&
            item !== undefined &&
            typeof item === 'object' &&
            'prNumber' in item,
        );
        return JSON.stringify(filtered);
      }

      return JSON.stringify(context);
    });

    // Equality helper
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    // Length helper
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper('length', (arr: unknown) => {
      return Array.isArray(arr) ? arr.length : 0;
    });

    // Greater than helper
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper('gt', (a: unknown, b: unknown) => {
      return Number(a) > Number(b);
    });

    // ParseInt helper
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper('parseInt', (str: unknown, radix: unknown) => {
      const s = typeof str === 'string' ? str : '';
      const r = typeof radix === 'number' ? radix : 10;
      return Number.parseInt(s, r);
    });

    // Label text color helper - determines text color based on background color brightness
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper('labelTextColor', (color: unknown) => {
      const hexColor = typeof color === 'string' ? color : 'ffffff';
      const hex = hexColor.replace('#', '');
      const r = Number.parseInt(hex.substring(0, 2), 16);
      const g = Number.parseInt(hex.substring(2, 4), 16);
      const b = Number.parseInt(hex.substring(4, 6), 16);
      // Calculate relative luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Use white text for dark backgrounds, black for light backgrounds
      return luminance > 0.5 ? '#000' : '#fff';
    });

    // Format time with business days helper
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper(
      'formatTimeWithDays',
      (hours: string | number) => {
        const h = Number.parseInt(hours as string, 10);
        if (h <= 0) {
          return '0h';
        }

        // 24 hours per business day
        const days = Math.round((h / 24) * 10) / 10;
        return `${hours}h (${days}d)`;
      },
    );

    // OR helper - returns first truthy value or executes block
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper('or', (...args: unknown[]) => {
      const key = args.length - 1;
      const options = args[key] as {
        fn?: () => unknown;
        inverse?: () => unknown;
      };

      const isCheckOption = options?.fn;

      if (isCheckOption) {
        for (let i = 0; i < args.length - 1; i++) {
          if (args[i]) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return options?.fn?.call(this);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return options.inverse ? options.inverse.call(this) : '';
      }
      return args.slice(0, -1).some(Boolean);
    });

    // Add helper - sums multiple numbers
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    hbs.default.registerHelper('add', (...args: number[]) => {
      const numbers = args.slice(0, -1);
      return numbers.reduce((sum, num) => sum + (num || 0), 0).toFixed(2);
    });
  }
}
