var rp = require('request-promise');
var getOktaToken = require('./fetchOktaToken').getOktaToken;

let oktaToken = undefined;
let assets_api_url;
let okta_token_api_url;
let okta_token_api_userid;
let okta_token_api_pass;

async function getGatewayData(OKTA_PARAMETERS, ASSETS_API) {
    let isAPIExecuted = false; let retryCount = 0; let maxAttempt = 4;
    let pageCounter = 1;
    let recordLimit = 1000;
    let gatewayDetails = [];
    gatewayDetails.length = 0;
    
    assets_api_url = ASSETS_API;
    okta_token_api_url = OKTA_PARAMETERS.oktaAPIAuthUrl;
    okta_token_api_userid = OKTA_PARAMETERS.oktaUserId;
    okta_token_api_pass = OKTA_PARAMETERS.oktaPassword;

    console.log(`getGatewayData`);
    try {

        oktaToken = await getOktaToken(okta_token_api_url, okta_token_api_userid, okta_token_api_pass);

        let gatewayCount = await getGatewaysRecordCount(oktaToken);

        let totalGatewayPages = (gatewayCount / recordLimit) === 0 ? parseInt(gatewayCount / recordLimit) : parseInt((gatewayCount / recordLimit)) + 1;

        console.log(`gatewayCount: ${gatewayCount}`);
        console.log(`totalGatewayPages: ${totalGatewayPages}`);

        while (!isAPIExecuted && retryCount <= maxAttempt && gatewayCount > 0) {
            try {
                for (let nextPage = pageCounter; nextPage <= totalGatewayPages; nextPage++) {
                    pageCounter = nextPage;
                    gatewayDetails = await getGatewayDetailsByPage(nextPage, oktaToken, gatewayDetails, recordLimit);
                    console.log(`Page ${nextPage}; gatewayDetails lenght:${gatewayDetails.length}`);
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
                    console.log(`Failed to fetch data from gateway api at page ${pageCounter}`);
                }

                if (pageCounter > totalGatewayPages) {
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
    console.log(`gatewayDetails length:${gatewayDetails.length}`);
    return gatewayDetails;
}

function concatGateWayDataArrays(array1, array2) {
    if (array2) {
        return [...array2, ...array1.data.assets];
    }
    return array1.data.assets;
}

getGatewaysRecordCount = (oktaToken) => {
    return new Promise((resolve, reject) => {
        var getGatewaysRecordCountOption = {
            method: 'GET',
            url: `${assets_api_url}&page=1&pageSize=1`,
            headers: { 'authorization': `Bearer ${oktaToken}` },
            rejectUnauthorized: false            
        }

        rp(getGatewaysRecordCountOption)
            .then((response) => {                
                return resolve(JSON.parse(response).data.assets[0].totalRecords)
            })
            .catch(error => reject(error));
    })
}

getGatewayDetailsByPage = (pageNo, oktaToken, gatewayDetails, recordLimit) => {
    return new Promise((resolve, reject) => {
        var getGatewayDetailsByPageOption = {
            method: 'GET',
            url: `${assets_api_url}&page=${pageNo}&pageSize=${recordLimit}`,
            headers: { 'authorization': `Bearer ${oktaToken}` },
            rejectUnauthorized: false
        }

        rp(getGatewayDetailsByPageOption)
            .then((response) => {
                let details = JSON.parse(response);
                if (details.data.assets.length > 0) {
                    let concatenatedArray = concatGateWayDataArrays(details, gatewayDetails);
                    return resolve(concatenatedArray);
                }
                return resolve(gatewayDetails);
            })
            .catch(error => reject(error));
    })
}

module.exports = {
    getGatewayData
}
