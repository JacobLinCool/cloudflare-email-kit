import { Context, Middleware } from "./types";

export class EmailKit {
	protected middlewares: Middleware[] = [];

	use(middleware: Middleware): this {
		this.middlewares.push(middleware);
		return this;
	}

	async handle(ctx: Context) {
		const execute = async (index: number) => {
			if (index < this.middlewares.length) {
				let used = false;
				const middleware = this.middlewares[index];
				await middleware.handle(ctx, () => {
					if (used) {
						throw new Error(
							`next() called multiple times in middleware ${middleware.name}`,
						);
					}
					used = true;
					return execute(index + 1);
				});
			}
		};

		await execute(0);
	}
}
