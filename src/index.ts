import { argv } from 'process';

import { setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';

import { collectCoverage } from './collect/collectCoverage';
import { generateReport } from './report/generateReport';
import { FailReason } from './typings/Report';

async function run() {
    try {
        const {
            payload: { pull_request },
            repo,
        } = context;

        if (!pull_request) {
            throw new Error(
                'jest-coverage-report-action supports only pull requests.'
            );
        }

        const [
            token,
            testScript,
            coverageThresholdStr,
            workingDirectory,
        ] = argv.slice(2);

        const coverageThreshold = coverageThresholdStr
            ? parseFloat(coverageThresholdStr)
            : undefined;

        if (
            coverageThreshold !== undefined &&
            (coverageThreshold > 100 || coverageThreshold < 0)
        ) {
            throw new Error(
                `Specified threshold '${coverageThreshold}' is not valid. Threshold should be more than 0 and less than 100.`
            );
        }

        const octokit = getOctokit(token);

        const headReport = await collectCoverage(
            testScript,
            undefined,
            workingDirectory
        );
        const baseReport = await collectCoverage(
            testScript,
            pull_request.base.ref,
            workingDirectory
        );

        if (
            coverageThreshold !== undefined &&
            headReport.success &&
            headReport.summary &&
            headReport.details &&
            !headReport.failReason &&
            headReport.summary.find((value) => value.title === 'Statements')!
                .percentage < coverageThreshold
        ) {
            headReport.success = false;
            headReport.failReason = FailReason.UNDER_THRESHOLD;
        }

        await generateReport(
            headReport,
            baseReport,
            coverageThreshold,
            repo,
            pull_request,
            octokit,
            workingDirectory
        );
    } catch (error) {
        setFailed(error.message);
    }
}

run();
