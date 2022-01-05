
getDeviceTwinData = async (registry, slicedDeviceIDs) => {
    console.log("GetDeviceTwinData");
    let isAPIExecuted = false; let retryCount = 0; let maxAttempt = 4; let deviceIds = '';
    let deviceTwinJsonList = [];   
    deviceTwinJsonList.length = 0;
    
    try {
        for(i = 0; i < slicedDeviceIDs.length; i++){
            deviceIds = '';
            isAPIExecuted = false;
            retryCount = 0;
            slicedDeviceIDs[i].forEach(function(item){
                deviceIds += `'${item}',`;
            })
            deviceIds = deviceIds.substring(0, deviceIds.length - 1);
            //var query = registry.createQuery(`SELECT * FROM devices where deviceId='1AESE238'`, 50);
            strQuery = `SELECT * FROM devices where deviceId IN [${deviceIds}]`;
            query = registry.createQuery(strQuery, 500);           

            while (!isAPIExecuted && retryCount <= maxAttempt) {
                try {
                    while (query.hasMoreResults) {
                        let deviceTwins = await query.nextAsTwin();
                        deviceTwins.result.forEach(deviceTwin => {
                            deviceTwinJsonList.push(deviceTwin);
                        })
                    }
                    //console.log(`deviceTwinJsonList length:${deviceTwinJsonList.length}`);
                    if (deviceTwinJsonList.length == 0) {
                        isAPIExecuted = false;                    
                        retryCount = retryCount + 1;                                       
                    
                        if (retryCount > maxAttempt) {
                            console.log(`Failed to fetch device twin data from gateway. Reached max retry count.`);
                            isAPIExecuted = true;
                        }
                        else{
                            console.log(`Failed to fetch device twin data from gateway. Retry count ${retryCount}`);
                        }
                    }
                    else{
                        isAPIExecuted = true;
                        retryCount = 0;
                    }
                }
                catch (error) {
                    console.log(error);
                    isAPIExecuted = false;
                    retryCount = retryCount + 1;               
    
                    if (retryCount > maxAttempt) {
                        console.log(`Failed to fetch device twin data from gateway. Reached max retry count.`);
                        isAPIExecuted = true;
                    }
                    else{
                        console.log(`Failed to fetch device twin data from gateway. Retry count ${retryCount}`);
                    }
                }
            }
        }        
        return deviceTwinJsonList;
    }
    catch (error) {
        console.log(error);
        throw error;
    }
}

module.exports = {
    getDeviceTwinData
}
