module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            const babelLoader = webpackConfig.module.rules.find(
                (rule) => rule.oneOf && Array.isArray(rule.oneOf)
            ).oneOf.find(
                (r) => r.loader && r.loader.includes('babel-loader')
            );

            if (babelLoader) {
                babelLoader.exclude = /node_modules\/(?!papaparse)/;
            }

            return webpackConfig;
        },
    },
};
