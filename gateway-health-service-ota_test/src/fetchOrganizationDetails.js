var rp = require('request-promise');
var getElevateApiToken = require('./parkerElevateApi').getElevateApiToken;

let elevateApiToken = undefined;
let elevate_api_org_url;
let elevate_token_api_url;
let elevate_token_api_email;
let elevate_token_api_pass;

async function getOrganizationDetails(ELEVATE_API_ORG_URL, ELEVATE_TOKEN_API_URL_PARAMETERS) {
    let isAPIExecuted = false; let retryCount = 0; let maxAttempt = 4;
    let orgsDetails = [];
    orgsDetails.length = 0;
    
    elevate_api_org_url = ELEVATE_API_ORG_URL;
    elevate_token_api_url = ELEVATE_TOKEN_API_URL_PARAMETERS.url;
    elevate_token_api_email = ELEVATE_TOKEN_API_URL_PARAMETERS.email;
    elevate_token_api_pass = ELEVATE_TOKEN_API_URL_PARAMETERS.pass;

    console.log(`getOrganizationDetails`);
    try {
        elevateApiToken = await getElevateApiToken(elevate_token_api_url, elevate_token_api_email, elevate_token_api_pass);

        while (!isAPIExecuted && retryCount <= maxAttempt) {
            try {
                orgsDetails = await getOrgDetails(elevateApiToken);               
                isAPIExecuted = true;
            } catch (error) {
                console.log(error);
                elevateApiToken = await getElevateApiToken(elevate_token_api_url, elevate_token_api_email, elevate_token_api_pass);
                isAPIExecuted = false;
                retryCount = retryCount + 1;

                if (retryCount > maxAttempt) {
                    console.log(`Failed to fetch Org details at retryCount ${retryCount}`);
                }
            }
        }        
    } catch (error) {
        console.log(error.message);
        throw error;
    }
    return orgsDetails
}

getOrgDetails = (elevateApiToken) => {
    return new Promise((resolve, reject) => {
        var getOrgDetails = {
            method: 'GET',           
            url: elevate_api_org_url,
            headers: { authorization: elevateApiToken }
        }

        rp(getOrgDetails)
            .then(elevateOrgResp => {
                return resolve(JSON.parse(elevateOrgResp).children);
            }).catch(error => reject(error))

    });
}


module.exports = {
    getOrganizationDetails
}
