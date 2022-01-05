var rp = require('request-promise');
var getOktaToken = require('./fetchOktaToken').getOktaToken;

let oktaToken = undefined;
let org_api_url;
let okta_token_api_url;
let okta_token_api_userid;
let okta_token_api_pass;

async function getOrgData(OKTA_PARAMETERS, ORG_API) {
    let isAPIExecuted = false; let retryCount = 0; let maxAttempt = 4;
    let pageCounter = 1;
    let recordLimit = 1000;
    let orgsDetails = [];
    orgsDetails.length = 0;
    
    org_api_url = ORG_API;
    okta_token_api_url = OKTA_PARAMETERS.oktaAPIAuthUrl;
    okta_token_api_userid = OKTA_PARAMETERS.oktaUserId;
    okta_token_api_pass = OKTA_PARAMETERS.oktaPassword;

    console.log(`getOrgData`);
    try {

        oktaToken = await getOktaToken(okta_token_api_url, okta_token_api_userid, okta_token_api_pass);

        let orgCount = await getOrgCount(oktaToken);

        let totalOrgPages = (orgCount / recordLimit) === 0 ? parseInt(orgCount / recordLimit) : parseInt((orgCount / recordLimit)) + 1;

        console.log(`orgCount: ${orgCount}`);
        console.log(`totalOrgPages: ${totalOrgPages}`);

        while (!isAPIExecuted && retryCount <= maxAttempt && orgCount > 0) {
            try {
                for (let nextPage = pageCounter; nextPage <= totalOrgPages; nextPage++) {
                    pageCounter = nextPage;
                    orgsDetails = await getOrgDetailsByPage(nextPage, oktaToken, orgsDetails, recordLimit);
                    console.log(`Page ${nextPage}; orgsDetails lenght:${orgsDetails.length}`);
                    retryCount = 0;                    
                }
                isAPIExecuted = true;
            } catch (error) {
                console.log(`Failed to fetch page ${pageCounter}:${error.message}; Retry page ${pageCounter}`);
                //console.log(error);
                oktaToken = await getOktaToken(okta_token_api_url, okta_token_api_userid, okta_token_api_pass);
                isAPIExecuted = false;
                retryCount = retryCount + 1;

                if (retryCount > maxAttempt) {
                    console.log(`Failed to fetch data from org api at page ${pageCounter}`);
                }

                if (pageCounter > totalOrgPages) {
                    console.log(`pageCounter > total pages: ${pageCounter}`);
                    isAPIExecuted = true;
                }

            }
        }
    }
    catch (error) {
        console.log(error.message);
        throw error;
    }
    console.log(`orgsDetails length:${orgsDetails.length}`);
    return orgsDetails;
}

function concatOrgDataArrays(array1, array2) {
    if (array2) {
        return [...array2, ...array1.data.orgs];
    }
    return array1.data.orgs;
}

getOrgCount = (oktaToken) => {
    return new Promise((resolve, reject) => {
        var getOrgCountOption = {
            method: 'GET',
            url: `${org_api_url}&page=1&pageSize=1`,
            headers: { 'authorization': `Bearer ${oktaToken}` },
            rejectUnauthorized: false
        }

        rp(getOrgCountOption)
            .then((response) => {               
                return resolve(JSON.parse(response).data.orgs[0].totalRecords)
            })
            .catch(error => reject(error));
    })
}

getOrgDetailsByPage = (pageNo, oktaToken, orgsDetails, recordLimit) => {
    return new Promise((resolve, reject) => {
        var getOrgDetailsByPageOption = {
            method: 'GET',
            url: `${org_api_url}&page=${pageNo}&pageSize=${recordLimit}`,
            headers: { 'authorization': `Bearer ${oktaToken}` },
            rejectUnauthorized: false
        }

        rp(getOrgDetailsByPageOption)
            .then((response) => {
                let details = JSON.parse(response);
                if (details.data.orgs.length > 0) {
                    let concatenatedArray = concatOrgDataArrays(details, orgsDetails);
                    return resolve(concatenatedArray);
                }
                return resolve(orgsDetails);
            })
            .catch(error => reject(error));
    })
}

module.exports = {
    getOrgData
}
