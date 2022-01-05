var rp = require('request-promise');
var getElevateApiToken = require('./parkerElevateApi').getElevateApiToken;

let elevateApiToken = undefined;
let debug = false;
let elevate_api_mastertag_url;
let elevate_token_api_url;
let elevate_token_api_email;
let elevate_token_api_pass;

async function getPakerElevateGatewayData(ELEVATE_API_MASTERTAG_URL, ELEVATE_TOKEN_API_URL_PARAMETERS) {
    let isAPIExecuted = false; let retryCount = 0; let maxAttempt = 4;
    let pageCounter = 1;
    let recordLimit = 1000;
    let gatewayDetails = [];
    gatewayDetails.length = 0;
    
    elevate_api_mastertag_url = ELEVATE_API_MASTERTAG_URL;
    elevate_token_api_url = ELEVATE_TOKEN_API_URL_PARAMETERS.url;
    elevate_token_api_email = ELEVATE_TOKEN_API_URL_PARAMETERS.email;
    elevate_token_api_pass = ELEVATE_TOKEN_API_URL_PARAMETERS.pass;

    console.log(`getPakerElevateGateway`);
    try {

        elevateApiToken = await getElevateApiToken(elevate_token_api_url, elevate_token_api_email, elevate_token_api_pass);

        let gatewayCount = await getGatewayCount(elevateApiToken);

        let totalGatewayPages = (gatewayCount / recordLimit) === 0 ? parseInt(gatewayCount / recordLimit) : parseInt((gatewayCount / recordLimit)) + 1;

        console.log(`gatewayCount: ${gatewayCount}`);
        console.log(`totalGatewayPages: ${totalGatewayPages}`);

        while (!isAPIExecuted && retryCount <= maxAttempt && gatewayCount > 0) {
            try {
                for (let nextPage = pageCounter; nextPage <= totalGatewayPages; nextPage++) {
                    pageCounter = nextPage;
                    gatewayDetails = await getGatewayDetails(nextPage, elevateApiToken, gatewayDetails, recordLimit);
                    console.log(`Page ${nextPage}; gatewayDetails lenght:${gatewayDetails.length}`);
                    retryCount = 0;

                    if (debug && pageCounter == 2)
                        break;
                }

                isAPIExecuted = true;
            } catch (error) {
                console.log(`Failed to fetch page ${pageCounter}:${error.message}; Retry page ${pageCounter}`);
                //console.log(error);
                elevateApiToken = await getElevateApiToken(elevate_token_api_url, elevate_token_api_email, elevate_token_api_pass);
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

function concatArrays(array1, array2) {
    if (array2) {
        return [...array2, ...array1.data];
    }
    return array1.data;
}

getGatewayCount = (elevateApiToken) => {
    return new Promise((resolve, reject) => {
        var getGatewayCountAPI = {
            method: 'GET',
            url: `${elevate_api_mastertag_url}2&order=ASC&page=1&status=active,inactive,whitelisted`,
            headers: { authorization: elevateApiToken }
        }

        rp(getGatewayCountAPI)
            .then((response) => {                
                return resolve(JSON.parse(response).count)
            })
            .catch(error => reject(error));            
    })
}

getGatewayDetails = (pageNo, elevateApiToken, gatewayDetails, recordLimit) => {
    return new Promise((resolve, reject) => {
        var gatewayDetailsAPI = {
            method: 'GET',
            url: `${elevate_api_mastertag_url}${recordLimit}&order=ASC&page=${pageNo}&status=active,inactive,whitelisted`,
            headers: { authorization: elevateApiToken }
        }

        rp(gatewayDetailsAPI)
            .then((response) => {
                let details = JSON.parse(response);
                if (details.data.length > 0) {
                    let concatenateArray = concatArrays(details, gatewayDetails);
                    return resolve(concatenateArray);
                }
                return resolve(gatewayDetails);
            })
            .catch(error => reject(error));
    })
}

module.exports = {
    getPakerElevateGatewayData
}
