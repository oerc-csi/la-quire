import Command from '#src/Command.js';
import crypto from 'crypto';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createInterface } from 'readline';
import yaml from 'js-yaml';

// Define concepts, paths, and immutables
const primaryNameUris = ['https://lux.collections.yale.edu/data/concept/f7ef5bb4-e7fb-443d-9c6b-371a23e717ec', 'http://vocab.getty.edu/aat/300404670'];
const periodUris = ['https://lux.collections.yale.edu/data/concept/c1cb739d-db1e-4e93-bb03-64f135e0b4cb', 'http://vocab.getty.edu/aat/300081446'];
const objectTypeUris = ['https://lux.collections.yale.edu/data/concept/4ea65dc4-76bc-45b7-b54c-a1ca4783d4e2', 'http://vocab.getty.edu/aat/300435443'];
const accessionUris = ['https://lux.collections.yale.edu/data/concept/3d9696be-0b9a-4a3d-b380-7584fbf96ac7', 'http://vocab.getty.edu/aat/300312355'];
const enUris = ['https://lux.collections.yale.edu/data/concept/dfa53b96-4eda-4c9a-b091-10008a726c38', 'http://vocab.getty.edu/aat/300388277'];
const creditLineUris = ['https://lux.collections.yale.edu/data/concept/7c0ba119-47cb-4ade-8aa3-32a1e66c8ca9', 'http://vocab.getty.edu/aat/300435418'];
const webPageUris = ['https://lux.collections.yale.edu/data/concept/2eca07bd-be42-4ef5-9ec5-87c1bbfe639d', 'http://vocab.getty.edu/aat/300264578'];
const thumbnailUris = ['https://lux.collections.yale.edu/data/concept/b28a48ef-4d40-44d1-81c9-27f0411b030b', 'http://vocab.getty.edu/aat/300215302'];
const descriptionUris = ['https://lux.collections.yale.edu/data/concept/b9d84f17-662e-46ef-ab8b-7499717f8337', 'http://vocab.getty.edu/aat/300435416', 'http://vocab.getty.edu/aat/300080091'];
const citationUris = ['https://lux.collections.yale.edu/data/concept/ceef9d2e-1a07-4269-827f-8c407e4d4711', 'http://vocab.getty.edu/aat/300311705', 'http://vocab.getty.edu/aat/300026497'];
const dimensionsStatementUris = ['https://lux.collections.yale.edu/data/concept/53922f57-dab5-43c5-a527-fc20a63fe128', 'http://vocab.getty.edu/aat/300435430'];
const accessStatementUris = ['https://lux.collections.yale.edu/data/concept/03f4eb19-0611-4f31-8e09-fc111c52f898', 'http://vocab.getty.edu/aat/300133046'];
const materialsStatementUris = ['https://lux.collections.yale.edu/data/concept/a51a170c-211c-4cc1-bb11-52e24836117f', 'http://vocab.getty.edu/aat/300435429'];
const provenanceUris = ['https://lux.collections.yale.edu/data/concept/dd8b8c75-3f4b-4071-a231-161ae556e572', 'http://vocab.getty.edu/aat/300435438'];
const linkedArtCachePath = './content/_assets/linked-art.json';
const figureCachePath = path.join('./content/_assets/figures.json');
const immutableFieldNames = ['id', 'title', 'figure', 'link', 'thumbnail'];


// Function to validate that certain field names in a configuration object are not modified
function validateObjectFieldNames(config) {
    // Get the field names from the objectFieldNames property of the config object
    const objectFieldNames = Object.keys(config.objectFieldNames);

    // Find any field names that are both immutable and present in objectFieldNames
    const intersection = immutableFieldNames.filter(fieldName => objectFieldNames.includes(fieldName));

    // If any immutable field names are found in the intersection, throw an error
    if (intersection.length > 0) {
        throw new Error(`Cannot change the following immutable field names in config.yaml: ${immutableFieldNames.join(', ')}`);
    }
}

// Asynchronous function to fetch data from a specified URI
async function fetchData(uri) {
    try {
        // Make an HTTP request to the given URI with specific headers
        let response = await fetch(uri, {
            headers: {
                'Accept': 'application/ld+json, application/json' // Requesting JSON-LD or JSON
            }
        });
        // Check if the HTTP response status is OK (status code 200-299)
        if (response.ok) {
            // Parse and return the JSON data from the response
            return await response.json();
        }
    } catch (error) {
        // Log an error message to the console if an exception occurs
        console.error(`An error occurred while fetching data from ${uri}`);
    }
    // Return undefined if the response isn't OK or an error occurs
    return;
}

// Asynchronous function to search for a specific classification in a list of URIs
async function searchClassifiedAs(classified_as, uris) {
    // Check if the classified_as parameter is an array
    if (Array.isArray(classified_as)) {
        // Iterate through each item in the classified_as array
        for (const item of classified_as) {
            // Check if the item has an 'id' property and if the id exists in the uris array
            if (item.id && uris.includes(item.id)) {
                // Return true if a matching id is found
                return true;
            }
        }
    }
    // Return undefined if no match is found or classified_as is not an array
    return;
}

// Asynchronous function to extract all 'id' properties from an array of objects
async function getIds(array) {
    // Initialize an empty array to store the extracted IDs
    let ids = [];

    // Check if the input is an array
    if (Array.isArray(array)) {
        // Loop through each item in the array
        for (const item of array) {
            // If the item has an 'id' property, add it to the ids array
            if (item.id) {
                ids.push(item.id);
            }
        }
        // Return the array of extracted IDs
        return ids;
    }
    // Return undefined if the input is not an array
    return;
}

// Function to format an array into a specific output format
function formatArray(arr) {
    // Check if the array is empty
    if (arr.length === 0) {
        // Return undefined for an empty array
        return;
    } 
    // Check if the array contains only one element
    else if (arr.length === 1) {
        // Return the single element directly
        return arr[0];
    } 
    // If the array contains multiple elements
    else {
        // Join the elements into a comma-separated string and return it
        return arr.join(', ');
    }
}

// Asynchronous function to filter and categorize content based on various criteria
async function getContent(data, array, primaryNameUris, enUris, contentType, precision) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    // Initialize arrays to hold categorized content
    let primaryAndEn = [];
    let primary = [];
    let other = [];

    try {
        // Check if the provided array is valid
        if (Array.isArray(array)) {
            // Iterate over each item in the array
            for (const item of array) {
                // If no specific contentType is required or the item's type matches the contentType
                if (!contentType || item.type === contentType) {
                    let hasPrimaryNameUri = false;
                    let hasEnUri = false;

                    // Check if the item is classified with any of the primaryNameUris
                    if (Array.isArray(item.classified_as)) {
                        hasPrimaryNameUri = await searchClassifiedAs(item.classified_as, primaryNameUris);
                    }

                    // Check if the item's language matches any of the enUris
                    if (Array.isArray(item.language)) {
                        hasEnUri = await searchClassifiedAs(item.language, enUris);
                    }

                    // Categorize the content based on precision and classification/language match
                    if (precision.includes('primaryAndEn') && hasPrimaryNameUri && hasEnUri) {
                        primaryAndEn.push(item.content); // Both primary name and English language match
                    } else if (precision.includes('primary') && hasPrimaryNameUri && !hasEnUri) {
                        primary.push(item.content); // Only primary name matches
                    } else if (precision.includes('other') && !hasPrimaryNameUri && !hasEnUri) {
                        other.push(item.content); // Neither primary name nor English language matches
                    }
                }
            }
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching content:', error);
        return;
    }

    // Return an object containing categorized content arrays
    return { primaryAndEn, primary, other };
}

// Asynchronous function to retrieve object data, either from a cache or by fetching it
async function getObjectData(linkedArtCachePath, uri, options) {
    let cachedData = {}; // Initialize an empty object to hold cached data
    let objectData; // Variable to store the retrieved object data

    try {
        // Attempt to read the cache file asynchronously
        const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
        // Parse the cache file content into a JavaScript object
        cachedData = JSON.parse(cacheContent);
    } catch (error) {
        // If the error is not related to the file not existing, rethrow it
        if (error.code !== 'ENOENT') {
            throw error;
        }
        // If the file doesn't exist (ENOENT), proceed without cached data
    }

    // Check if the URI exists in the cached data and if the 'force' option is not set
    if (uri in cachedData && !options['force']) {
        // Retrieve the object data from the cache
        objectData = cachedData[uri].objectData;
    } else {
        // If not cached or if 'force' is set, fetch the object data from the URI
        objectData = await fetchData(uri);
    }

    // Return the retrieved object data
    return objectData;
}

// Asynchronous function to find the title of an object based on specific criteria
async function findObjectTitle(data, primaryNameUris, enUris, precision) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    try {
        // Retrieve categorized content (primaryAndEn, primary, other) from the data
        const { primaryAndEn, primary, other } = await getContent(
            data,               // Full data object
            data.identified_by, // Array of identifying properties
            primaryNameUris,    // URIs for primary name classification
            enUris,             // URIs for English language classification
            'Name',             // Content type to filter by
            precision           // Precision criteria to determine categorization
        );

        // Prioritize content based on precision:
        // 1. Return formatted array of items that match both primary and English URIs
        if (primaryAndEn.length > 0) {
            return formatArray(primaryAndEn);
        } 
        // 2. Return formatted array of items that match only primary URIs
        else if (primary.length > 0) {
            return formatArray(primary);
        } 
        // 3. Return formatted array of items that match neither primary nor English URIs
        else if (other.length > 0) {
            return formatArray(other);
        } 
        // If no matching content is found, log a message and return undefined
        else {
            console.log('Object title not found.');
            return;
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching object title:', error);
        return;
    }
}

// Asynchronous function to find and return a LinguisticObject from the data
async function findLinguisticObject(data, linguisticObjectUris) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let result; // Variable to store the result if a LinguisticObject is found

    try {
        // Check if the referred_to_by property exists and is an array
        if (Array.isArray(data.referred_to_by)) {
            // Iterate over each item in the referred_to_by array
            for (const item of data.referred_to_by) {
                // Check if the item type is 'LinguisticObject' and it has classified_as property as an array
                if (item.type === 'LinguisticObject' && Array.isArray(item.classified_as)) {
                    // Check if the item is classified under any of the linguisticObjectUris
                    if (await searchClassifiedAs(item.classified_as, linguisticObjectUris)) {
                        // If a match is found, store the content of the item and return it
                        result = item.content;
                        return result;
                    }
                }
            }
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log(`An error occurred while fetching LinguisticObject:`, error);
        return;
    }

    // Return the result, which will be undefined if no match is found
    return result;
}

// Asynchronous function to find and return the accession number from the data
async function findAccession(data, accessionUris) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let accession; // Variable to store the accession number if found

    try {
        // Iterate over each item in the identified_by property of the data
        for (const item of data.identified_by) {
            // Check if the item type is 'Identifier' (i.e., a potential accession number)
            if (item.type === 'Identifier') {
                // Check if the item is classified under any of the given accessionUris
                if (await searchClassifiedAs(item.classified_as, accessionUris)) {
                    // If a match is found, store the content (accession number) and return it
                    accession = item.content;
                    return accession;
                }
            }
        }

        // If no accession number is found, log a message
        if (!accession) {
            console.log('Accession number not found.');
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching accession number:', error);
        return;
    }

    // Return the found accession number, or undefined if no match was found
    return accession;
}

// Asynchronous function to find and return the creator(s) based on provided data and URIs
async function findCreator(data, uris, enUris, precision) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let creatorIds = []; // Array to store creator URIs or IDs

    try {
        // Check if 'produced_by' has a 'part' property, which contains creator information
        if (data.produced_by && data.produced_by.part) {
            // Iterate over each part in the 'produced_by' property
            for (const item of data.produced_by.part) {
                // Get IDs from 'carried_out_by' for each item
                const ids = await getIds(item.carried_out_by);
                // If IDs are found, add them to the creatorIds array
                if (ids !== undefined && ids.length > 0) {
                    creatorIds.push(ids);
                }
            }
        } 
        // If 'produced_by' contains a direct 'carried_out_by' property
        else if (data.produced_by && data.produced_by.carried_out_by) {
            const ids = await getIds(data.produced_by.carried_out_by);
            // If IDs are found, add them to the creatorIds array
            if (ids !== undefined && ids.length > 0) {
                creatorIds.push(ids);
            }
        }

        // If no creator URIs are found, log a message and exit
        if (creatorIds.length === 0) {
            console.log('No creator URIs found.');
            return;
        }

        // Modify creator IDs to append ".json" if they start with the Getty vocabulary URI
        creatorIds = creatorIds.map(id => String(id).startsWith("https://vocab.getty.edu") ? id + ".json" : id);

        // Loop through each creator URI to fetch additional creator data
        for (const id of creatorIds) {
            try {
                // Fetch creator data using the ID
                const creatorData = await fetchData(id);

                // Get categorized content for creator data using identified_by and provided URIs
                const { primaryAndEn, primary, other } = await getContent(creatorData, creatorData.identified_by, uris, enUris, 'Name', precision);

                // Return formatted array of primary and English content if available
                if (primaryAndEn.length > 0) {
                    return formatArray(primaryAndEn);
                } 
                // Return formatted array of primary content if available
                else if (primary.length > 0) {
                    return formatArray(primary);
                } 
                // Return formatted array of other content if available
                else if (other.length > 0) {
                    return formatArray(other);
                }
            } catch (fetchError) {
                // If fetching the creator data fails, continue to the next ID
                continue;
            }
        }

        // If creator URIs are found but no name extraction is successful, return the creator URIs
        if (creatorIds.length > 0) {
            console.log('Creator URI found, but name extraction was unsuccessful. Returning URI.');
            return formatArray(creatorIds.map(id => id.toString()));
        } else {
            // If no creator is found, log a message and return undefined
            console.log('Creator not found.');
            return;
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching creator:', error);
        return;
    }
}

// Asynchronous function to find and return the year from the provided data
async function findYear(data, keyValuePairs) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let year; // Variable to store the year if found

    try {
        // Check if the data contains 'produced_by' -> 'timespan' -> 'identified_by' and retrieve the year from it
        if (data.produced_by && data.produced_by.timespan && data.produced_by.timespan.identified_by) {
            year = data.produced_by.timespan.identified_by[0].content;
        }

        // If no year is found, check if the keyValuePairs object does not contain the 'period' value
        if (!year) {
            // If 'period' is not included in the keyValuePairs, log a suggestion to try 'period'
            if (!Object.values(keyValuePairs).includes('period')) {
                console.log('Year not found. Try period.');
            } else {
                // If 'period' is included or no year is found, log a generic 'Year not found' message
                console.log('Year not found.');
            }
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching year:', error);
    }

    // Return the found year (or undefined if not found)
    return year;
}

// Asynchronous function to find and return the object type based on provided data and URIs
async function findObjectType(data, objectTypeUris, primaryNameUris, enUris, precision) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let objectTypeIds = []; // Array to store object type IDs found in the data
    let objectType; // Variable to store the final object type if found

    try {
        // If 'classified_as' is an array, iterate over it to find matching object types
        if (Array.isArray(data.classified_as)) {
            for (const item of data.classified_as) {
                // Search for the object type using the classified_as property
                const result = await searchClassifiedAs(item.classified_as, objectTypeUris);
                if (result) {
                    // If a match is found, add the item ID to the objectTypeIds array
                    objectTypeIds.push(item.id);
                }
            }
        }

        // If no object type IDs are found in 'classified_as', check the 'referred_to_by' property
        if (objectTypeIds.length === 0) {
            if (Array.isArray(data.referred_to_by)) {
                // If 'referred_to_by' is available, attempt to find the object type from linguistic objects
                const result = await findLinguisticObject(data, objectTypeUris);
                if (result) {
                    // If a linguistic object is found, set it as the object type and return it
                    objectType = result;
                    return objectType;
                }
            }
        }

        // Modify object type IDs to append ".json" if they start with the Getty vocabulary URI
        objectTypeIds = objectTypeIds.map(uri => String(uri).startsWith("https://vocab.getty.edu") ? uri + ".json" : uri);

        // Loop through each object type ID to fetch additional object type data
        for (const uri of objectTypeIds) {
            try {
                // Fetch object type data using the ID
                const objectTypeData = await fetchData(uri);

                // Get categorized content for object type data using identified_by and provided URIs
                const { primaryAndEn, primary, other } = await getContent(objectTypeData, objectTypeData.identified_by, primaryNameUris, enUris, 'Name', precision);

                // Return formatted array of primary and English content if available
                if (primaryAndEn.length > 0) {
                    return formatArray(primaryAndEn);
                } 
                // Return formatted array of primary content if available
                else if (primary.length > 0) {
                    return formatArray(primary);
                } 
                // Return formatted array of other content if available
                else if (other.length > 0) {
                    return formatArray(other);
                }
            } catch (fetchError) {
                // If fetching the object type data fails, continue to the next ID
                continue;
            }
        }

        // If object type URIs are found but no name extraction is successful, return the object type URIs
        if (objectTypeIds.length > 0) {
            console.log('Object type URI found, but name extraction was unsuccessful. Returning URI.');
            return formatArray(objectTypeIds.map(uri => uri.toString()));
        }

        // If no object type IDs are found and no object type was set, log a message and return undefined
        if (objectTypeIds.length === 0 && !objectType) {
            console.log('Object type not found.');
            return;
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching object type:', error);
        return;
    }
}

// Asynchronous function to find and return the web page based on provided data and URIs
async function findWebPage(data, webPageUris) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let webPage; // Variable to store the web page if found

    try {
        // Check if 'subject_of' is an array, which may contain information about digital objects
        if (Array.isArray(data.subject_of)) {
            // Iterate through each 'subject_of' item
            for (const subject_of of data.subject_of) {
                // Check if 'digitally_carried_by' is an array (indicating a digital carrier)
                if (Array.isArray(subject_of.digitally_carried_by)) {
                    // Iterate through each 'digitally_carried_by' item
                    for (const digitally_carried_by of subject_of.digitally_carried_by) {
                        // Check if the 'digitally_carried_by' item matches one of the provided webPageUris
                        if (await searchClassifiedAs(digitally_carried_by.classified_as, webPageUris)) {
                            // If a match is found, set the webPage to the access point ID and return it
                            webPage = digitally_carried_by.access_point[0].id;
                            return webPage;
                        }
                    }
                }
            }
        }

        // Check the 'subject_of' array again for direct matches with webPageUris
        if (Array.isArray(data.subject_of)) {
            for (const item of data.subject_of) {
                // Search for a match in the 'classified_as' property
                if (await searchClassifiedAs(item.classified_as, webPageUris)) {
                    // If a match is found, set the webPage to the item ID and return it
                    webPage = item.id;
                    return webPage;
                }
            }
        }

        // If no web page is found, log a message indicating so
        if (!webPage) {
            console.log('Web page not found.');
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching web page:', error);
        return;
    }

    // Return the found web page (or undefined if not found)
    return webPage;
}

// Asynchronous function to find and return the thumbnail URI based on provided data and URIs
async function findThumbnailUri(data, thumbnailUris) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let thumbnailUri; // Variable to store the thumbnail URI if found

    try {
        // Check if 'representation' exists and is an array (indicating representations of the data)
        if (data.representation && Array.isArray(data.representation)) {
            // Iterate through each representation to look for a matching thumbnail
            for (const representation of data.representation) {
                // Check if 'digitally_shown_by' exists and is an array (indicating digital representations of an image)
                if (representation.digitally_shown_by && Array.isArray(representation.digitally_shown_by)) {
                    // Iterate through each item in 'digitally_shown_by'
                    for (const digitally_shown_by of representation.digitally_shown_by) {
                        // Check if the 'digitally_shown_by' item matches any of the provided thumbnail URIs
                        if (await searchClassifiedAs(digitally_shown_by.classified_as, thumbnailUris)) {
                            // If a match is found, set the thumbnail URI and return it
                            thumbnailUri = digitally_shown_by.access_point[0].id;
                            return thumbnailUri;
                        }
                    }
                }
                // If 'digitally_shown_by' doesn't exist, check 'classified_as' directly
                else {
                    // If a match is found, set the thumbnail URI and return it
                    if (await searchClassifiedAs(representation.classified_as, thumbnailUris)) {
                        thumbnailUri = representation.id;
                        return thumbnailUri;
                    }
                }
            }
        }

        // If no thumbnail URI is found, log a message indicating so
        if (!thumbnailUri) {
            console.log('Thumbnail URI not found.');
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching thumbnail URI:', error);
        return;
    }

    // Return the found thumbnail URI (or undefined if not found)
    return thumbnailUri;
}

// Asynchronous function to find and return the description based on provided data, description URIs, and precision
async function findDescription(data, descriptionUris, enUris, precision) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let description; // Variable to store the description if found

    try {
        // Check if 'referred_to_by' is an array (it may contain references to descriptions or linguistic objects)
        if (Array.isArray(data.referred_to_by)) {
            // Call the 'getContent' function to get content classified as 'LinguisticObject'
            const { primaryAndEn, primary, other } = await getContent(data, data.referred_to_by, descriptionUris, enUris, 'LinguisticObject', precision)
            
            // If any content is found with both primary and English URIs, return it formatted
            if (primaryAndEn.length > 0) {
                return formatArray(primaryAndEn);
            } 
            // If only primary content is found, return it formatted
            else if (primary.length > 0) {
                return formatArray(primary);
            } 
            // If any other content is found, return it formatted
            else if (other.length > 0) {
                return formatArray(other);
            }
        }

        // If no description is found, log a message indicating so
        if (!description) {
            console.log('Description not found.');
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching description:', error);
        return;
    }

    // Return the found description (or undefined if not found)
    return description;
}

// Asynchronous function to find and return citations based on provided data and citation URIs
async function findCitations(data, citationUris) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let citations = []; // Array to store found citations

    try {
        // Check if 'referred_to_by' exists and is an array (it may contain references to citations)
        if (Array.isArray(data.referred_to_by)) {
            // Iterate through each item in 'referred_to_by' to find matching citations
            for (const item of data.referred_to_by) {
                // Check if the item matches any of the provided citation URIs
                if (await searchClassifiedAs(item.classified_as, citationUris)) {
                    // Push the citation content or ID to the 'citations' array
                    citations.push(item.content || item.id);
                }
            }
        }

        // If no citations are found, log a message indicating so
        if (citations.length === 0) {
            console.log('No citations found.');
            return;
        } else {
            // Return the found citations
            return citations;
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching citations:', error);
        return;
    }
}

// Asynchronous function to find and return the "find spot" based on provided data and primary name URIs
async function findFindSpot(data, primaryNameUris) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let findSpotId; // Variable to store the find spot ID
    let findSpot; // Variable to store the find spot name

    try {
        // Check if 'encountered_by' exists and if it has a valid 'took_place_at' value
        if (data.encountered_by && data.encountered_by[0].took_place_at) {
            findSpotId = data.encountered_by[0].took_place_at[0].id; // Get the find spot ID
            // Fetch data for the find spot using its ID
            const findSpotData = await fetchData(findSpotId);
            if (findSpotData) {
                // Find the primary name of the find spot and return it
                findSpot = await findPrimaryName(findSpotData, primaryNameUris);
                return findSpot;
            }
        }

        // If no find spot is found in the previous check, attempt to find it using linguistic data
        if (!findSpot) {
            findSpot = findLinguisticObject(data, 'https://data.getty.edu/museum/ontology/linked-data/tms/object/place/found')
            if (findSpot) {
                return findSpot;
            }
        }

        // If no find spot is found, log a message indicating so
        if (!findSpot) {
            console.log('Find spot not found.');
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching find spot:', error);
    }
    return findSpot; // Return the find spot (or undefined if not found)
}

// Asynchronous function to find and return the set based on provided data and primary name URIs
async function findSet(data, primaryNameUris) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let setId; // Variable to store the set ID
    let set; // Variable to store the set name

    try {
        // Check if 'member_of' exists and fetch the set data if available
        if (data.member_of) {
            setId = data.member_of[0].id; // Get the set ID
            const setData = await fetchData(setId); // Fetch data for the set using its ID
            if (setData) {
                // Find the primary name of the set and return it
                set = await findPrimaryName(setData, primaryNameUris);
                return set;
            }
        }

        // If no set is found, log a message indicating so
        if (!set) {
            console.log('Set not found.');
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching set:', error);
    }
    return set; // Return the set (or undefined if not found)
}

// Asynchronous function to find and return the owner based on provided data and primary name URIs
async function findOwner(data, primaryNameUris) {
    // Check if data is available; log a message and exit if not
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let ownerId; // Variable to store the owner ID
    let owner; // Variable to store the owner name

    try {
        // Check if 'current_owner' exists and fetch the owner data if available
        if (data.current_owner) {
            ownerId = data.current_owner[0].id; // Get the owner ID
            const ownerData = await fetchData(ownerId); // Fetch data for the owner using its ID
            if (ownerData) {
                // Find the primary name of the owner and return it
                owner = await findPrimaryName(ownerData, primaryNameUris);
                return owner;
            }
        }

        // If no owner is found, log a message indicating so
        if (!owner) {
            console.log('Owner not found.');
        }
    } catch (error) {
        // Log any errors encountered during the process
        console.log('An error occurred while fetching owner:', error);
    }
    return owner; // Return the owner (or undefined if not found)
}

// Asynchronous function to find location based on provided data and primary name URIs
async function findLocation(data, primaryNameUris) {
    // Check if data is not available, log a message and return
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let locationId; // Variable to store location ID
    let location; // Variable to store the location data

    try {
        // If current_location exists in the data, fetch the corresponding location
        if (data.current_location) {
            locationId = data.current_location.id; // Get location ID
            const locationData = await fetchData(locationId); // Asynchronously fetch location data using location ID
            if (locationData) {
                // Find the primary name for the location using the provided URIs
                location = await findPrimaryName(locationData, primaryNameUris);
                return location; // Return the location if found
            }
        };

        // If location wasn't found, log a message
        if (!location) {
            console.log('Location not found.');
        }
    } catch (error) {
        // If an error occurs during the fetching process, log the error
        console.log('An error occurred while fetching location:', error);
    }
    return location; // Return the location (could be undefined if not found)
}

// Asynchronous function to find "Took Place At" based on provided data and primary name URIs
async function findTookPlaceAt(data, primaryNameUris) {
    // Check if data is not available, log a message and return
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let tookPlaceAtId; // Variable to store the "took place at" ID
    let tookPlaceAt; // Variable to store the "took place at" location data

    try {
        // Check if "produced_by" and "took_place_at" exist in data
        if (data.produced_by && data.produced_by.took_place_at) {
            tookPlaceAtId = data.produced_by.took_place_at[0].id; // Get the ID
            const tookPlaceAtData = await fetchData(tookPlaceAtId); // Asynchronously fetch "took place at" data
            if (tookPlaceAtData) {
                // Find the primary name for the "took place at" using the provided URIs
                tookPlaceAt = await findPrimaryName(tookPlaceAtData, primaryNameUris);
                return tookPlaceAt; // Return the "took place at" if found
            }
        }

        // Check if "encountered_by" and "took_place_at" exist in data
        if (data.encountered_by && data.encountered_by[0].took_place_at) {
            tookPlaceAtId = data.encountered_by[0].took_place_at[0].id; // Get the ID
            const tookPlaceAtData = await fetchData(tookPlaceAtId); // Asynchronously fetch "took place at" data
            if (tookPlaceAtData) {
                // Find the primary name for the "took place at" using the provided URIs
                tookPlaceAt = await findPrimaryName(tookPlaceAtData, primaryNameUris);
                return tookPlaceAt; // Return the "took place at" if found
            }
        }

        // If "took place at" wasn't found, log a message
        if (!tookPlaceAt) {
            console.log('Took place at not found.');
        }
    } catch (error) {
        // If an error occurs during the fetching process, log the error
        console.log('An error occurred while fetching took place at:', error);
    }
    return tookPlaceAt; // Return the "took place at" (could be undefined if not found)
}

// Asynchronous function to find "Encountered By" based on provided data, URIs, and precision
async function findEncounteredBy(data, uris, enUris, precision) {
    // Check if data is not available, log a message and return
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let encounteredByIds = []; // Array to store encountered by IDs

    try {
        // If "encountered_by" exists in data, iterate through each item and get IDs
        if (data.encountered_by) {
            for (const item of data.encountered_by) {
                const ids = await getIds(item.carried_out_by); // Asynchronously get IDs of those who encountered
                encounteredByIds.push(ids); // Add the IDs to the encounteredByIds array
            }
        }

        // If no "encountered by" IDs were found, log a message and return
        if (encounteredByIds.length === 0) {
            console.log('No encountered by URIs found.');
            return;
        }

        // Modify the encounteredByIds to append ".json" to the ones starting with the specified URL
        encounteredByIds = encounteredByIds.map(id => String(id).startsWith("https://vocab.getty.edu") ? id + ".json" : id);

        // Iterate over the encounteredByIds to fetch their corresponding data
        for (const id of encounteredByIds) {
            try {
                const encounteredByData = await fetchData(id); // Asynchronously fetch the "encountered by" data
                // Asynchronously get the primary and other name details based on the fetched data
                const { primaryAndEn, primary, other } = await getContent(encounteredByData, encounteredByData.identified_by, uris, enUris, 'Name', precision);
                if (primaryAndEn.length > 0) {
                    return formatArray(primaryAndEn); // Return the formatted primary and English names
                } else if (primary.length > 0) {
                    return formatArray(primary); // Return the formatted primary names
                } else if (other.length > 0) {
                    return formatArray(other); // Return the formatted other names
                }
            } catch (fetchError) {
                // If an error occurs during the fetching of "encountered by" data, continue with the next ID
                continue;
            }
        }

        // If encounteredByIds were found but name extraction failed, return the URIs
        if (encounteredByIds.length > 0) {
            console.log('Encountered by URI found, but name extraction was unsuccessful. Returning URI.')
            return formatArray(encounteredByIds.map(id => id.toString()));
        } else {
            // If no encountered by data was found, log a message
            console.log('Encountered by not found.');
            return;
        }
    } catch (error) {
        // If an error occurs during the fetching process, log the error
        console.log('An error occurred while fetching encountered by:', error);
        return;
    }
}

// Helper function used within the dimensions pattern
// This function checks if the entry should be excluded based on its classification
// Currently it excludes "positional attributes" (AAT), which are used in Getty data to enumerate data values but are not physical dimensions
// The function can be extended to exclude other classifications if necessary in the future
function excludeEntry(entry) {
    // If the entry is classified as a positional attribute, return true to exclude it
    return entry.classified_as?.some(classification => findGettyUri(classification) === "http://vocab.getty.edu/aat/300010269");
}

// Helper function to retrieve dimension and unit labels from structured data
// This function fetches the labels for dimension type and its unit (if available) using their Getty URIs
async function getDimensionAndUnitLabels(dimension) {
    // Find the Getty URI for the dimension type and unit (if available)
    const dimensionUri = findGettyUri(dimension.classified_as);
    const unitUri = dimension.unit ? findGettyUri(dimension.unit) : null;

    // Asynchronously retrieve both the dimension label and unit label in parallel
    const [dimensionLabel, unitLabel] = await Promise.all([
        dimensionUri ? getTerm(dimensionUri, "Dimension") : null,
        unitUri ? getTerm(unitUri, "Unit") : null
    ]);

    // Log messages if the dimension or unit label couldn't be retrieved
    if (!dimensionLabel) {
        logMessages.add(`Unable to retrieve dimension type from ${dimensionUri || dimension.classified_as.map(item => item.id).join(', ')}`);
    }

    if (!unitLabel) {
        logMessages.add(`Unable to retrieve dimension unit from ${unitUri || (dimension.unit ? dimension.unit.id : 'unknown unit')}`);
    }

    // Return the retrieved labels
    return { dimensionLabel, unitLabel };
}    

// Pattern One handles dimensions data where set information (e.g., "frame", "unframed") is provided using the "member_of" property
// This is the structure used in Getty's data for dimensions information
async function processPatternOne(dimension) {
    // Retrieve the dimension label and unit label asynchronously
    const { dimensionLabel, unitLabel } = await getDimensionAndUnitLabels(dimension);
    
    // If the dimension value, label, and unit are available, return the formatted dimension string, otherwise return null
    return dimension.value && dimensionLabel && unitLabel ? `${dimensionLabel}: ${dimension.value} ${unitLabel}` : null;
}

// Pattern Two handles dimensions data where similar information is provided either via an additional classification label
// Referring to the dimension's "assigned_by" property, or it may be directly associated with the dimension
// Examples of this pattern can be found in other datasets like Yale's Lux collection
async function processPatternTwo(dimension) {
    // Retrieve the dimension label and unit label asynchronously
    const { dimensionLabel, unitLabel } = await getDimensionAndUnitLabels(dimension);
    let additionalClassLabel = null; // Placeholder for any additional classification label

    // Check if the dimension has been assigned a classification label through "assigned_by"
    if (dimension.assigned_by && Array.isArray(dimension.assigned_by)) {
        for (const assignment of dimension.assigned_by) {
            if (assignment.classified_as && assignment.classified_as.length > 0) {
                // If a classification label exists, fetch it asynchronously
                const additionalUri = assignment.classified_as[0]?.id;
                additionalClassLabel = additionalUri ? await getTerm(additionalUri, "Additional Classification") : null;

                // Log a message if the additional classification label cannot be retrieved
                if (!additionalClassLabel) {
                    logMessages.add(`Unable to retrieve additional classification label from ${additionalUri}`);
                }
                break;
            }
        }
    } else if (dimension.classified_as && dimension.classified_as.length > 1) {
        // If the dimension has multiple classifications, fetch the second one as an additional classification label
        const additionalUri = dimension.classified_as[1]?.id;
        additionalClassLabel = additionalUri ? await getTerm(additionalUri, "Additional Classification") : null;

        // Log a message if the additional classification label cannot be retrieved
        if (!additionalClassLabel) {
            logMessages.add(`Unable to retrieve additional classification label from ${additionalUri}`);
        }
    }

    // Return the formatted dimension and unit data with the additional classification label (if available)
    return dimension.value && dimensionLabel && unitLabel ? { statement: `${dimensionLabel}: ${dimension.value} ${unitLabel}`, additionalClassLabel: additionalClassLabel || '' } : null;
}

// Further helper function to process a dimension based on its properties
// This decides whether to use Pattern One or Pattern Two based on the dimension's structure
async function processDimension(dimension) {
    // If the entry is excluded (e.g., positional attribute), return null
    if (excludeEntry(dimension)) return null;

    // If the dimension is part of a set (i.e., has "member_of"), process using Pattern One
    if (dimension.member_of && Array.isArray(dimension.member_of)) {
        return await processPatternOne(dimension);
    } else {
        // Otherwise, process using Pattern Two
        return await processPatternTwo(dimension);
    }
}

// Asynchronous function to find and categorize dimensions data from a provided 'data' object
async function findDimensions(data) {
    const dimensionsBySet = {}; // Object to store dimensions categorized by set label
    
    // Check if the data has a 'dimension' property and it's an array
    if (data.dimension && Array.isArray(data.dimension)) {
        // Iterate through each dimension in the 'dimension' array
        for (const dim of data.dimension) {
            // Process each dimension asynchronously
            const dimensionsData = await processDimension(dim);
            
            if (dimensionsData) {
                let setLabel = ''; // Initialize variable for set label
                
                // If dimensionsData is a string (e.g., simple dimension data)
                if (typeof dimensionsData === 'string') {
                    // For each member in the dimension's 'member_of' property, get the set label
                    for (const member of dim.member_of) {
                        const label = await getTerm(member.id, "Set Label");
                        if (label) {
                            setLabel = label;
                            break;
                        }
                    }
                    // If no existing entry for the set label, initialize it as an empty array
                    if (!dimensionsBySet[setLabel]) dimensionsBySet[setLabel] = [];
                    // Push the dimension data into the set label category
                    dimensionsBySet[setLabel].push(dimensionsData);
                } else {
                    // For more complex dimension data, categorize by additionalClassLabel
                    const { statement, additionalClassLabel } = dimensionsData;
                    // If no existing entry for the additionalClassLabel, initialize it
                    if (!dimensionsBySet[additionalClassLabel]) dimensionsBySet[additionalClassLabel] = [];
                    // Push the statement (dimension data) into the appropriate label category
                    dimensionsBySet[additionalClassLabel].push(statement);
                }
            }
        }
    }
    
    // Format the dimensionsBySet object into a string and return it
    return Object.entries(dimensionsBySet)
        .map(([set, dims]) => `${set ? `${set}: ` : ''}${dims.join('; ')}`)
        .join('\n') || null; // Return formatted string or null if empty
}

// Function to recursively find Getty vocabulary URIs within an object
function findGettyUri(obj) {
    if (obj && typeof obj === 'object') {
        // If obj is an array, check each item recursively
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const foundUri = findGettyUri(item);
                if (foundUri) return foundUri; // Return found URI if found
            }
        } else {
            // If obj is an object, check each value recursively
            for (const value of Object.values(obj)) {
                // If value is a string and contains a Getty URI, return it
                if (typeof value === 'string' && value.includes('vocab.getty.edu')) return value;
                const foundUri = findGettyUri(value); // Recursive call for nested values
                if (foundUri) return foundUri; // Return found URI if found
            }
        }
    }
    return null; // Return null if no Getty URI is found
}

// Asynchronous function to retrieve terms from URIs, with preference for preferred terms
async function getTerm(uri, dataField, termType = 'preferred') {
    try {
        const data = await fetchData(uri); // Fetch data from the URI
        const identifiedBy = data?.identified_by; // Get the identified_by field if it exists
        
        if (Array.isArray(identifiedBy)) {
            // Iterate through each item in the identified_by array
            for (const item of identifiedBy) {
                const classifiedAs = item?.classified_as || []; // Get the classified_as field
                
                // If looking for a preferred term
                if (termType === 'preferred') {
                    // Check if any classification is the preferred Getty term
                    if (classifiedAs.some(ca => ca.id === "http://vocab.getty.edu/aat/300404670")) return item.content;
                    if (classifiedAs.some(ca => ca.equivalent?.some(eq => eq.id === "http://vocab.getty.edu/aat/300404670"))) return item.content;
                } else {
                    // If looking for an alternative term
                    if (classifiedAs.some(ca => ca.id === "http://vocab.getty.edu/aat/300404670")) {
                        const alternativeContent = item?.alternative?.[0]?.content; // Get the alternative term content
                        if (alternativeContent) return alternativeContent;
                    }
                }
            }
        }
        // If no preferred term is found, return the label content and log the issue
        if (termType === 'preferred') {
            const label = data?.label || data?._label; // Use label or _label if no preferred term
            if (label) {
                logMessages.add(`No preferred term found for ${uri}. "${label === data?.label ? 'label' : '_label'}" retrieved instead.`);
                return label;
            }
        }
        throw new Error(`No ${termType} term found for ${uri}`); // Throw error if no term found
    } catch (error) {
        logMessages.add(`Error retrieving ${dataField} data: ${error.message}`); // Log error message if fetch or processing fails
        return null; // Return null in case of error
    }
}

// Asynchronous function to find image URI in a IIIF manifest
async function findImageUri(iiifManifestData) {
    // Check if iiifManifestData exists
    if (iiifManifestData) {
        const context = iiifManifestData['@context']; // Get the '@context' property to determine the IIIF version
        let imageUri; // Declare variable for the image URI

        // Check if context is an array or a single string
        if (Array.isArray(context)) {
            // If context includes IIIF Presentation 3 context
            if (context.includes('http://iiif.io/api/presentation/3/context.json')) {
                imageUri = iiifManifestData.items?.[0]?.items?.[0]?.items?.[0]?.body?.id; // Extract image URI from IIIF v3 structure
            } 
            // If context includes IIIF Presentation 2 context
            else if (context.includes('http://iiif.io/api/presentation/2/context.json')) {
                imageUri = iiifManifestData.sequences?.[0]?.canvases?.[0]?.images?.[0]?.resource["@id"]; // Extract image URI from IIIF v2 structure
            }
        } else {
            // If context is a single string, check for IIIF Presentation 3 or 2
            if (context === 'http://iiif.io/api/presentation/3/context.json') {
                imageUri = iiifManifestData.items?.[0]?.items?.[0]?.items?.[0]?.body?.id;
            } else if (context === 'http://iiif.io/api/presentation/2/context.json') {
                imageUri = iiifManifestData.sequences?.[0]?.canvases?.[0]?.images?.[0]?.resource["@id"];
            }
        }

        // If an image URI is found, return it
        if (imageUri) {
            return imageUri;
        }
    }
    // If no image URI is found, return undefined
    return;
}

// Asynchronous function to resize an image based on user input
async function resizeImage(iiifManifestData, options, imageUri) {
    // Check if resize option is enabled
    if (options.resize) {
        // Initialize readline interface to interact with the user through the command line
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Determine the largest dimension (width or height) from the image data in the IIIF manifest
        const defaultWidth = iiifManifestData.items?.[0]?.items?.[0]?.items?.[0]?.body?.width;
        const defaultHeight = iiifManifestData.items?.[0]?.items?.[0]?.items?.[0]?.body?.height;
        const largestDimensionName = defaultWidth >= defaultHeight ? 'width' : 'height';

        // Prompt the user for resize options (either number of pixels or percentage)
        console.log('Enter the number or percentage of pixels for resizing (e.g., 800 for pixels, or 50% for percentage). This will be applied to the largest dimension (width or height), and the other dimension will be scaled proportionally.');

        // Display the largest dimension (either width or height)
        if (largestDimensionName === 'width') {
            console.log('The largest dimension is', largestDimensionName, 'at', defaultWidth, 'pixels.');
        } else if (largestDimensionName === 'height') {
            console.log('The largest dimension is', largestDimensionName, 'at', defaultHeight, 'pixels.');
        }

        // Wait for the user to input their resize choice (pixels or percentage)
        const resizeOption = await new Promise((resolve) => {
            rl.question('', (answer) => {
                rl.close(); // Close the readline interface once the input is received
                resolve(answer);
            });
        });

        // Check if the input is valid (either a number of pixels or a percentage string)
        if (!isNaN(resizeOption) || (typeof resizeOption === 'string' && resizeOption.endsWith('%'))) {
            const largestDimensionSize = largestDimensionName === 'width' ? defaultWidth : defaultHeight;

            // Check if the resize option exceeds the largest dimension
            if (!isNaN(resizeOption) && !(typeof resizeOption === 'string' && resizeOption.endsWith('%'))) {
                if (parseInt(resizeOption) > largestDimensionSize) {
                    console.error('The resize option cannot exceed the largest dimension of the full-size image.');
                    return;
                }
            } else if (typeof resizeOption === 'string' && resizeOption.endsWith('%')) {
                const percentage = parseFloat(resizeOption.slice(0, -1)); // Extract percentage from the string
                if (percentage > 100) {
                    console.error('The resize option cannot exceed 100%.');
                    return;
                }
            }

            // Calculate the resized dimensions
            let resizedUri;

            if (typeof resizeOption === 'string' && resizeOption.endsWith('%')) {
                // Resize by percentage
                const proportion = parseFloat(resizeOption.slice(0, -1)) / 100;
                const newWidth = largestDimensionName === 'width' ? Math.round(defaultWidth * proportion) : '';
                const newHeight = largestDimensionName === 'height' ? Math.round(defaultHeight * proportion) : '';
                resizedUri = imageUri.replace('/full/full/0/default.jpg', `/full/${newWidth},${newHeight}/0/default.jpg`);
            } else {
                // Resize by pixel count
                const newWidth = largestDimensionName === 'width' ? parseInt(resizeOption) : '';
                const newHeight = largestDimensionName === 'height' ? parseInt(resizeOption) : '';
                resizedUri = imageUri.replace('/full/full/0/default.jpg', `/full/${newWidth},${newHeight}/0/default.jpg`);
            }

            // Notify the user that the image has been resized successfully
            console.log(`Image resized successfully to ${resizeOption}.`);
            return resizedUri; // Return the resized URI
        } else {
            // Handle invalid input for resize
            console.error('Invalid resize option. Please provide either a number of pixels or a percentage.');
            return;
        }
    }
}

// Function to generate a hash for a buffer using the MD5 algorithm
function hashBuffer(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex'); // Return the MD5 hash as a hexadecimal string
}

// Asynchronous function to initiate an interactive prompt for building a Linked Art entry
async function startEntryBuildingInteraction() {
    // Initialize readline interface to interact with the user through the command line
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // Notify the user that the Linked Art entry building process has started
        console.log("Interactive Linked Art entry building has been initialized.");

        // Load configuration file to get object field names from config.yaml
        const config = yaml.load(fs.readFileSync('./content/_data/config.yaml', 'utf8'));
        const objectFieldNames = Object.values(config.objectFieldNames).filter(fieldName => fieldName !== config.objectFieldNames.uri);

        // Prompt the user to select fields for the Linked Art entry (excluding title and URI)
        console.log("Choose the Linked Art data fields you would like to retrieve by entering a comma-separated list.");
        console.log("Note: object title and Linked Art URI are always included in the entries and therefore are not present in the list of options.");
        console.log(objectFieldNames.join(', '));

        // Wait for the user to input their chosen fields
        const chosenFields = await new Promise((resolve, reject) => {
            rl.question('', (chosenFields) => {
                resolve(chosenFields);
            });
        });

        // Close the readline interface after receiving input
        rl.close();

        // Convert the chosen fields into an array, trimming spaces and converting to lowercase
        let fieldsList = chosenFields.split(',').map(field => field.trim().toLowerCase());

        // Validate that each field in the list is valid
        for (const field of fieldsList) {
            if (!objectFieldNames.includes(field)) {
                throw new Error(`Invalid field '${field}' provided.`); // Throw an error if an invalid field is selected
            }
        }

        // Add the 'uri' field from the configuration to the list
        fieldsList.push(config.objectFieldNames.uri);
        
        return fieldsList; // Return the list of selected fields

    } catch (error) {
        rl.close(); // Close the readline interface if an error occurs
        return Promise.reject(error); // Reject the promise with the error
    }
}

// Function to start interaction if data type is 'Set'
function startActivityInteraction() {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Prompt the user
        console.log("The provided URI is of type 'Activity' and may be used to access a set of object URIs.");
        console.log("Enter 'p' to process all the objects in the set.");
        console.log("Enter 's' to generate a spreadsheet of information about the objects.");
        console.log("Enter 'b' to do both.");

        // Handle user input
        rl.question('', (answer) => {
            // Close the readline interface
            rl.close();

            // Resolve with the user's response
            resolve(answer.toLowerCase());
        });
    });
}

// Function to collect a set of object URIs using activity URI
async function collectSetUris(data, uri) {
    // Check if the link for the set of items exists
    const eventIncludedItemsLink = data?._links["lux:eventIncludedItems"]?.href;
    if (!eventIncludedItemsLink) {
        throw new Error('Link for the set of items was not found.');
    }
    let allObjectURIs = [];
    let page = 1;
    let nextPageLink = `${eventIncludedItemsLink}&page=${page}`;

    // Iterate through all available pages of the set
    while (nextPageLink) {
        // Get the page's data
        const nextPageLink = `${eventIncludedItemsLink}&page=${page}`;
        console.log(`Fetching page ${page} of the set...`);
        const setData = await fetchData(nextPageLink);

        // Collect URIs for the objects in the set from the current page
        const orderedItems = setData?.orderedItems || [];
        
        // Check if the page is empty
        if (orderedItems.length === 0) {
            break;
        }
        const objectURIs = orderedItems.map(item => item.id).filter(Boolean);
        allObjectURIs = allObjectURIs.concat(objectURIs);

        // Get the link for the next page, if available
        // Linked Art devs working on nextPageLink
        //nextPageLink = setData?._links?.next?.href;
        page++;
    }
    console.log('Number of object URIs collected:', allObjectURIs.length);
    uri = allObjectURIs.join(' '); // Join the array into a space-separated string
    return uri
}

// Function to find the primary name of an object based on its identifiers and a list of URIs
function findPrimaryName(data, primaryNameUris) {
    // Check if data is available, if not, log an error and return
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let primaryName;
    try {
        // Check if 'identified_by' exists and is an array
        if (Array.isArray(data.identified_by)) {
            // Iterate over each identifier in 'identified_by'
            for (const item of data.identified_by) {
                // Search if the item is classified as one of the primary name URIs
                const result = searchClassifiedAs(item.classified_as, primaryNameUris);
                // If a match is found, assign the name and return it
                if (result) {
                    primaryName = item.content;
                    return primaryName;
                }
            }
        }
    } catch (error) {
        // Log an error if something goes wrong during the process
        console.log('An error occurred while fetching preferred name:', error);
    }
    return primaryName; // Return the primary name if found, or undefined if not
}

// Asynchronous function to find IIIF (International Image Interoperability Framework) manifest data
async function findIIIFManifest(data) {
    // Check if data is available, if not, log an error and return
    if (!data) {
        console.log('Data not available.');
        return;
    }

    let iiifManifestData;
    let iiifFound = false;
    try {
        // Check if 'subject_of' exists and is an array
        if (data.subject_of && Array.isArray(data.subject_of)) {
            // Iterate through each subject in 'subject_of'
            for (const subject_of of data.subject_of) {
                // Check if it has 'digitally_carried_by' and if it is an array
                if (subject_of.digitally_carried_by && Array.isArray(subject_of.digitally_carried_by)) {
                    // Iterate through each item in 'digitally_carried_by'
                    for (const item of subject_of.digitally_carried_by) {
                        // Check if the item conforms to the IIIF standard and fetch the manifest
                        if (item.conforms_to && item.conforms_to[0].id && item.conforms_to[0].id.startsWith('http://iiif.io/api/presentation')) {
                            try {
                                // Fetch the IIIF manifest data and return it
                                iiifManifestData = await fetchData(item.access_point[0].id);
                                return iiifManifestData;
                            } catch (error){
                                console.error(`Failed to fetch IIIF manifests: ${error}`);
                            }
                        }
                    }
                }
            }
        }
        // If no IIIF manifest was found, try to find one using other attributes in 'subject_of'
        if (iiifFound === false && data.subject_of) {
            for (const item of data.subject_of) {
                if (item.conforms_to && item.conforms_to[0].id && item.conforms_to[0].id.startsWith('http://iiif.io/api/presentation')) {
                    try {
                        iiifManifestData = await fetchData(item.id);
                        return iiifManifestData;
                    } catch (error){
                        console.error(`Failed to fetch IIIF manifests: ${error}`);
                    }
                }
            }
        }
    } catch (error) {
        console.log(`An error occurred while fetching iiifManifestData:, ${error}`);
    }
    return iiifManifestData; // Return the IIIF manifest data if found, otherwise undefined
}

// Asynchronous function to create a spreadsheet (CSV) from linked art data
async function createSpreadsheet(uri, data, options) {
    // Retrieve the primary name for the activity from the given data
    let activityTitle = findPrimaryName(data, primaryNameUris);

    let uriList;
    uriList = uri.split(' '); // Split the input URI list into individual URIs
    const totalObjects = uriList.length; // Track total number of URIs to process
    let csvContent = 'Linked Art URI,Object Title,Creator,Object Type,Image URI\n'; // Define CSV header
    let processedObjects = 0; // Initialize counter for processed objects

    // Loop through each URI in the uriList to gather data
    for (const uri of uriList) {
        processedObjects++;
        let cachedData = {};
        try {
            // Try to read the cached data for performance improvement
            const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
            cachedData = JSON.parse(cacheContent);
        } catch (error) {
            // If no cache is found (ENOENT error), continue
            if (error.code !== 'ENOENT') {
                throw error; // Rethrow if error is not related to file not found
            }
        }

        let objectData;
        // Check if the data is available in the cache, otherwise fetch it
        if (uri in cachedData) {
            console.log(`Retrieving Linked Art from cache... ${processedObjects}/${totalObjects}`);
            objectData = cachedData[uri].objectData;
        } else {
            objectData = await getObjectData(linkedArtCachePath, uri, options); // Fetch data from API if not cached
        }

        // Extract and process various metadata attributes for the object
        let objectTitle = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
        let creator = await findCreator(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
        let type = await findObjectType(objectData, objectTypeUris, primaryNameUris, enUris, ['primaryAndEn', 'primary']);
        const iiifManifestData = await findIIIFManifest(objectData);

        // Try to extract the image URI from the IIIF manifest
        let imageUri;
        try {
            imageUri = await findImageUri(iiifManifestData);
        } catch (error) {
            console.error(`Image URI not found in IIIF manifest.`);
        }

        // Optionally resize the image if the option is enabled
        if (imageUri && options.resize) {
            try {
                imageUri = await resizeImage(iiifManifestData, options, imageUri);
            } catch (error) {
                console.error(`Error occurred while resizing image.`);
            }
        }

        // Append the gathered data into the CSV content string
        csvContent += `"${uri}","${objectTitle || 'Unknown Title'}","${creator || 'Unknown Creator'}","${type || 'Unknown Type'}","${imageUri || 'Image URI not found'}"\n`;
    }

    // Write the CSV content to a file
    activityTitle = activityTitle.replace(/[^\w\s\-]/g, '_'); // Replace non-word characters in the activity title
    await fs.promises.writeFile(`./${activityTitle}.csv`, csvContent); // Write the CSV file to the current directory
    console.log('Spreadsheet was created successfully and exported to current directory.');

    // If 'select' option is enabled, allow user to select specific creators and types
    if (options['select']) {
        const readline = createInterface({
            input: process.stdin,
            output: process.stdout
        });
    
        // Parse CSV content to extract unique creators and object types
        const creatorSet = new Set();
        const typeSet = new Set();
    
        // Split the CSV content into lines and extract the columns
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',');
        const creatorIndex = headers.findIndex(header => header.trim() === 'Creator');
        const typeIndex = headers.findIndex(header => header.trim() === 'Object Type');
    
        // Iterate over each line to gather unique creators and types
        for (let i = 1; i < lines.length; i++) {
            const columns = [];
            let column = '';
            let withinQuotes = false;
    
            // Handle CSV quoting and split the line into columns
            for (const char of lines[i]) {
                if (char === '"') {
                    withinQuotes = !withinQuotes;
                } else if (char === ',' && !withinQuotes) {
                    columns.push(column.trim());
                    column = '';
                } else {
                    column += char;
                }
            }
    
            columns.push(column.trim()); // Push the last column

            // Add unique creators and types to their respective sets
            const creator = columns[creatorIndex];
            const type = columns[typeIndex];
            if (creator && creator !== 'Unknown Creator') {
                creatorSet.add(creator);
            }
            if (type && type !== 'Unknown Type') {
                typeSet.add(type);
            }
        }
    
        const uniqueCreators = [...creatorSet];
        const uniqueTypes = [...typeSet];
    
        console.log('Unique Creator Names:', uniqueCreators);
        console.log('Unique Object Types:', uniqueTypes);
    
        // Allow user input to filter creators and types
        await new Promise((resolve) => {
            readline.question('Please select the URIs you would like to process based on creators and object types (e.g., "creators: raphael, vincent van gogh AND/OR types: drawing, painting"): ', async (input) => {
                let selectedCreators;
                let selectedTypes;
                const selections = input.split(/(?:\s+AND\s+|\s+OR\s+)/);
                selectedCreators = selections.find(sel => sel.startsWith('creators:'))?.split(':')[1]?.trim()?.split(',');
                selectedTypes = selections.find(sel => sel.startsWith('types:'))?.split(':')[1]?.trim()?.split(',');
                selectedCreators = await formatArray(selectedCreators);
                selectedTypes = await formatArray(selectedTypes);
                console.log('selected creators:', selectedCreators);
                console.log('selected types:', selectedTypes);
        
                const newUriList = [];
        
                // Re-fetch data based on filtered criteria and build a new list of URIs
                let cachedData = {};
                let objectData;
                try {
                    const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
                    cachedData = JSON.parse(cacheContent);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                }
                for (const uri of uriList) {
                    if (uri in cachedData) {
                        console.log(`Retrieving Linked Art from cache... ${processedObjects}/${totalObjects}`);
                        objectData = cachedData[uri].objectData;
                    } else {
                        objectData = await getObjectData(linkedArtCachePath, uri, options);
                    }

                    // Find creator and type and check if they match selected filters
                    let creator = await findCreator(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
                    let type = await findObjectType(objectData, objectTypeUris, primaryNameUris, enUris, ['primaryAndEn', 'primary']);
        
                    if (
                        (selectedCreators.includes(creator)) &&
                        (selectedTypes.includes(type))
                    ) {
                        newUriList.push(uri); // Add URI to the new list if it matches the filters
                    }
                }
        
                readline.close();
                uri = newUriList; // Redefine uriList with newUriList for further processing
                resolve(uri); // Resolve the promise with the filtered uri list
            });
        });
        return uri; // Return the filtered list of URIs
    }     
}

export default class yogLinkedArtCommand extends Command {
    static definition = {
        name: 'add',
        description: 'Fetch Linked Art',
        summary: 'fetch Linked Art',
        version: '',
        args: [
            ['<thing>', 'scaffold a new entry in the Quire data files: object, object.figure, figure, or spreadsheet'],
            ['<uri>', 'uri of the linked art object'],
            ['[id1]', 'quire entry id optional for object and figure but required for object.figure'],
            ['[id2]', 'optional quire entry id for object.figure']
        ],
        options: [
            [ '-d', '--dry-run', 'scaffold think without writing data to files' ],
            [ '-f', '--force', 'fetch or refetch data and ignore caches' ],
            [ '-i', '--interactive', 'build your linked art entry with an interactive prompt'],
            [ '-r', '--resize', 'resize the image retrieved'],
            [ '-s', '--select', 'select uris to process from activity spreadsheet'],
        ],
    };

    constructor() {
        super(yogLinkedArtCommand.definition);
    }

    async action(thing, uri, id1, id2, options) {
        try{
            // Load config.yaml and objects.yaml
            const config = yaml.load(fs.readFileSync('./content/_data/config.yaml', 'utf8'));
            let objectsYaml = yaml.load(fs.readFileSync('./content/_data/objects.yaml', 'utf8'));

            // Handle empty objects.yaml, empty object_display_order or object_list, and misplaced hyphens or empty strings in object_display_order or object_list
            // Check if object_display_order seciton in objects.yaml exists, if not, create it with some initial fields and write back objects.yaml
            // If object_display_order exists, but not object_list, object_list is created later just before metadata is pushed to the list
            if (!objectsYaml || 
                !objectsYaml.object_display_order || 
                objectsYaml.object_display_order.length === 0 || 
                objectsYaml === null || 
                (objectsYaml.object_display_order.length === 1 && 
                 objectsYaml.object_display_order[0] === null)
            ) {
                // Preserve existing object_list if it exists and has entries
                let existingObjectList = [];
                if (objectsYaml && objectsYaml.object_list && objectsYaml.object_list.length > 0) {
                    existingObjectList = objectsYaml.object_list;
                }
                objectsYaml = {};
                const initialFields = [
                    config.objectFieldNames.creator,
                    config.objectFieldNames.year,
                    config.objectFieldNames.accession,
                    config.objectFieldNames.uri
                ];
                objectsYaml.object_display_order = [];
                initialFields.forEach(field => {
                    objectsYaml.object_display_order.push(field);
                });

                // Restore existing object_list if it exists and has entries
                if (existingObjectList.length > 0) {
                    objectsYaml.object_list = existingObjectList;
                }
                try {
                    fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml), 'utf8');
                } catch (e) {
                    console.error('Failed to write objects.yaml:', e);
                }
                console.log('There were no fields in object_display_order of objects.yaml. It has been updated with an initial list of fields, including creator, year, accession, and linked art uri. This list can be modified at any time to include any of the following options which are found in the objectFieldList of config.yaml:');
                for (const [key, value] of Object.entries(config.objectFieldNames)) {
                    console.log(value);
                }
                return;
            }

            if (options['interactive']) {
                if (thing !== 'object') {
                    console.error('Interactive entry building only available for object entries.');
                    return;
                }
            
                try {
                    const fieldsList = await startEntryBuildingInteraction();

                    // Clear the existing order
                    objectsYaml.object_display_order = [];

                    // Push each field separately
                    fieldsList.forEach(field => {
                        objectsYaml.object_display_order.push(field);
                    });

                    // Write the updated YAML content back to the file
                    fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml), 'utf8');
                } catch (error) {
                    console.error("An error occurred during object entry building:", error.message);
                    process.exitCode = 1;
                    return;
                }
            }

            objectsYaml = yaml.load(fs.readFileSync('./content/_data/objects.yaml', 'utf8'));

            // Read the existing figures.yaml file
            let figuresYaml = yaml.load(fs.readFileSync('./content/_data/figures.yaml', 'utf8'));

            // Determine which fields will be retrieved and in what order
            const keyValuePairs = {};
            if (objectsYaml.object_display_order.length > 0 && config.objectFieldNames) {
                for (const item of objectsYaml.object_display_order) {
                for (const [key, value] of Object.entries(config.objectFieldNames)) {
                    if (item === value) {
                    keyValuePairs[item] = key;
                    }
                }
                }
            }

            // Check if user has provided multiple URIs
            let uriList;
            uriList = uri.split(' ');
            for (uri of uriList) {
                // Fetch Linked Art recording using content negotation to request JSON-LD
                const data = await fetchData(uri);
                const dataType = data['type']

                // Check if the retrieved record has the required data types
                if (!['HumanMadeObject', 'DigitalObject', 'Activity'].includes(dataType)) {
                    throw new Error(`Failed to process Linked Art. The retrieved record does not have one of the required types (HumanMadeObject, DigitalObject, or Activity).`);
                }

                // Start interaction if data type is 'Activity'
                if (dataType === 'Activity') {
                    const activityAnswer = await startActivityInteraction();
                    switch (activityAnswer) {
                        case 'p':
                            console.log('Processing all objects in the set...');
                            uri = await collectSetUris(data, uri);
                            break;
                        case 's':
                            console.log('Generating spreadsheet of information about the objects...');
                            uri = await collectSetUris(data, uri);
                            await createSpreadsheet(uri, data, options)
                            return;
                        case 'b':
                            console.log('Processing all objects in the set and generating spreadsheet...');
                            uri = await collectSetUris(data, uri);
                            if (options['select']) {
                                uri = await createSpreadsheet(uri, data, options)
                                break;
                            } else if (!options['select']) {
                                createSpreadsheet(uri, data, options)
                                break;
                            }
                        default:
                            throw new Error('Invalid choice. Please enter "p", "s", or "b".');
                    }
                }

                // Split the URI string by space and check if there are multiple URIs
                if (typeof uri === 'string' && uri.split(' ').length > 1) {
                    uriList = uri.split(' ');
                } else if (Array.isArray(uri) && uri.length > 1) {
                    // If the input is an array with multiple elements, assume it contains individual URIs
                    uriList = uri;
                } else {
                    // If the input is neither a string with multiple URIs nor an array with multiple elements, 
                    // consider it as a single URI
                    uriList = [uri];
                }
                for (uri of uriList) {
                    if (options['force']) {
                        console.log('Ignoring cache. If Linked Art for the URI already exists in cache, it will be overwritten.')
                    }

                    if (thing === 'object') {
                        // Validate the object field names
                        validateObjectFieldNames(config);

                        // Check if an objects.yaml entry exists for the URI
                        if (
                            objectsYaml.object_list && 
                            objectsYaml.object_list.some(obj => 
                                Object.values(obj).some(value => value === uri)
                            )
                        ) {
                            // Terminate code to avoid duplicate entry
                            if (!options['force']) {
                                console.log(`An entry for the URI already exists in the objects.yaml file.`);
                                break;
                            }
                            // Delete existing objects.yaml entry for uri if --force is used
                            else if (options['force']) {
                                const index = objectsYaml.object_list.findIndex(obj =>
                                    Object.values(obj).some(value => value === uri)
                                );
                                if (index !== -1) {
                                    console.log(`An entry for the URI already exists in the objects.yaml file. Overwriting...`)
                                    objectsYaml.object_list.splice(index, 1);
                                }
                            }
                        }

                        // Initialize figureId
                        let figureId;

                        // Initialize linked-art.json cache
                        let cachedData = {};

                        // Initialize variables for additional responses
                        let objectData, iiifManifestData;

                        try {
                            const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
                            cachedData = JSON.parse(cacheContent);
                        } catch (error) {
                            if (error.code !== 'ENOENT') {
                                throw error; // Rethrow the error if it is not related to file not found
                            }
                        }

                        // If the provided URI is already in cache, retrieve data from cache
                        if (uri in cachedData && !options['force']) {
                            console.log('Retrieving Linked Art from cache...');
                            objectData = cachedData[uri].objectData;
                            iiifManifestData = cachedData[uri].iiifManifestData;
                        }
                    
                        // Get objectData
                        if (!objectData) {
                            objectData = await getObjectData(linkedArtCachePath, uri, options);
                        }                                              
                    
                        iiifManifestData = await findIIIFManifest(objectData);

                        // Store fetched data in the cache file
                        cachedData[uri] = { objectData, iiifManifestData };
                        await fs.promises.writeFile(linkedArtCachePath, JSON.stringify(cachedData, null, 2), 'utf-8');
                        
                        // Find objectTitle in objectData
                        let objectTitle;
                        objectTitle = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
                        
                        // Find accession in objectData
                        let accession;
                        accession = await findAccession(objectData, accessionUris);
                        
                        // Find creditLine in objectData
                        let creditLine
                        creditLine = await findLinguisticObject(objectData, creditLineUris, 'Credit line');

                        // Find creator in the objectData
                        let creator;
                        if (Object.values(keyValuePairs).includes('creator')) {
                            creator = await findCreator(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
                        }

                        // Find object type in the objectData
                        let type;
                        if (Object.values(keyValuePairs).includes('type')) {
                            type = await findObjectType(objectData, objectTypeUris, primaryNameUris, enUris, ['primaryAndEn', 'primary']);
                        }
                        
                        // Find citations in objectData
                        let citations;
                        if (Object.values(keyValuePairs).includes('citations')) {
                            citations = await findCitations(objectData, citationUris);
                        }
                        // Find year in objectData
                        let year;
                        if (Object.values(keyValuePairs).includes('year')) {
                            year = await findYear(objectData, keyValuePairs);
                        }
                        
                        // Find accessStatement in objectData
                        let accessStatement;
                        if (Object.values(keyValuePairs).includes('accessStatement')) {
                            accessStatement = await findLinguisticObject(objectData, accessStatementUris, 'Access statement');
                        }
                        // Find webPage in objectData
                        let webPage;
                        if (Object.values(keyValuePairs).includes('webPage')) {
                            webPage = await findWebPage(objectData, webPageUris);
                        }
                        // Find thumbnailImg in objectData
                        let thumbnailImg;
                        if (Object.values(keyValuePairs).includes('thumbnailImg')) {
                            thumbnailImg = await findThumbnailUri(objectData, thumbnailUris)
                        }
                        // Find description in objectData
                        let description;
                        if (Object.values(keyValuePairs).includes('description')) {
                            description = await findDescription(objectData, descriptionUris, enUris, ['primaryAndEn', 'primary']);
                        }

                        // Find dimensions statement in objectData
                        let dimensions;
                        if (Object.values(keyValuePairs).includes('dimensions')) {
                            dimensions = await findLinguisticObject(objectData, dimensionsStatementUris);
                            if (!dimensions) {
                                dimensions = await findDimensions(objectData);
                            }
                        }

                        // Find materials statement in objectData
                        let materials;
                        if (Object.values(keyValuePairs).includes('materials')) {
                            materials = await findLinguisticObject(objectData, materialsStatementUris);
                        }

                        // Find access statement in objectData
                        let access;
                        if (Object.values(keyValuePairs).includes('access')) {
                            access = await findLinguisticObject(objectData, accessStatementUris);
                        }

                        // Find provenance in objectData
                        let provenance;
                        if (Object.values(keyValuePairs).includes('provenance')) {
                            provenance = await findLinguisticObject(objectData, provenanceUris);
                        }

                        // Find period in objectData
                        let period;
                        if (Object.values(keyValuePairs).includes('period')) {
                            period = await findLinguisticObject(objectData, periodUris)
                        }

                        // Find findSpot in objectData
                        let encounterPlace;
                        if (Object.values(keyValuePairs).includes('encounterPlace')) {
                            encounterPlace = await findFindSpot(objectData, primaryNameUris)
                        }

                        // Find set in objectData
                        let set;
                        if (Object.values(keyValuePairs).includes('set')) {
                            set = await findSet(objectData, primaryNameUris)
                        }

                        // Find owner in objectData
                        let owner;
                        if (Object.values(keyValuePairs).includes('owner')) {
                            owner = await findOwner(objectData, primaryNameUris)
                        }

                        // Find location in objectData
                        let location;
                        if (Object.values(keyValuePairs).includes('location')) {
                            location = await findLocation(objectData, primaryNameUris)
                        }

                        // Find location in objectData
                        let tookPlaceAt;
                        if (Object.values(keyValuePairs).includes('tookPlaceAt')) {
                            tookPlaceAt = await findTookPlaceAt(objectData, primaryNameUris)
                        }

                        // Find encountered by in objectData
                        let encounteredBy;
                        if (Object.values(keyValuePairs).includes('encounteredBy')) {
                            encounteredBy = await findEncounteredBy(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other'])
                        }

                        // Generate a new ID if not provided
                        let objectId;
                        if (id1 === 'accession') {
                            if (!accession) {
                                throw new Error('Accession number not found.');
                            }
                            objectId = accession;
                        } else if (!id1) {
                            if (!objectsYaml.object_list) {
                                objectsYaml.object_list = [];
                                try {
                                    fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml), 'utf8');
                                } catch (e) {
                                    console.error('Failed to write objects.yaml:', e);
                                }
                                objectId = 1;
                            } else {
                                const existingIds = objectsYaml.object_list.map(obj => parseInt(obj.id)).sort((a, b) => a - b);
                                for (let i = 1; i <= existingIds.length + 1; i++) {
                                    if (!existingIds.includes(i)) {
                                        objectId = i;
                                        break;
                                    }
                                }
                            }
                        } else {
                            if (objectsYaml.object_list.some(obj => obj.id.toString() === id1.toString())) {
                                console.log(`A record with the id ${id1} already exists.`);
                                break;
                            }
                            objectId = id1;
                        }
                        const metadata = {};
                        let uriIncluded = false;
                        metadata['id'] = objectId;
                        metadata['title'] = objectTitle;
                        
                        // Iterate through keyValuePairs and add fields to metadata if they exist
                        for (const [field, variable] of Object.entries(keyValuePairs)) {
                            // Check if the variable exists and is not an empty array
                            if (typeof eval(variable) !== 'undefined' && !(Array.isArray(eval(variable)) && eval(variable).length === 0)) {
                                metadata[field] = eval(variable);
                            }
                            if (field === 'uri') {
                                uriIncluded = true;
                            }
                        }
                        
                        // Ensure linked art uri is included in objects.yaml entry as certain functionality, such as duplicate prevention, depends on it
                        if (!uriIncluded) {
                            const uriVariable = config.objectFieldNames['uri']
                            metadata[uriVariable] = uri;
                        }
                        metadata['figure'] = [];

                        // Check if the cache file exists
                        let cache;
                        try {
                            const cacheData = fs.readFileSync(figureCachePath, 'utf8');
                            cache = JSON.parse(cacheData);
                        } catch (error) {
                            // If cache file doesn't exist, create an empty cache object
                            cache = {};
                            fs.writeFileSync(figureCachePath, '{}'); // Create the cache file
                        }

                        // Handle empty figures.yaml
                        if (!figuresYaml || 
                            !figuresYaml.figure_list || 
                            figuresYaml.figure_list.length === 0 || 
                            (figuresYaml.figure_list.length === 1 && 
                                (!figuresYaml.figure_list[0] || 
                                !figuresYaml.figure_list[0].id || 
                                figuresYaml.figure_list[0].id.trim() === '' ||
                                figuresYaml.figure_list[0].id.trim() === '-'))
                        ) {
                            figuresYaml = { figure_list: [] };
                        }

                        // Extract image URI
                        let imageUri;
                        try {
                            imageUri = await findImageUri(iiifManifestData);
                        } catch (error) {
                            console.error(`Image URI not found in IIIF manifest.`);
                        }

                        // Ensure imageUri is defined before proceeding
                        if (imageUri && options.resize) {
                            try {
                                imageUri = await resizeImage(iiifManifestData, options, imageUri);
                            } catch (error) {
                                console.error(`Error occurred while resizing image.`);
                            }
                        }

                        // Initialize existingFigure
                        let existingFigure;

                        // Check if figure_list in figures.yaml exists and contains valid entries
                        if (figuresYaml && figuresYaml.figure_list && Array.isArray(figuresYaml.figure_list)) {
                            try {
                                // Look for figure with the given uri
                                existingFigure = figuresYaml.figure_list.find(fig => fig.uri === uri);
                            } catch {
                                // Catch and let existingFigure remain undefined if 'cannot read properties of null (reading 'uri')'
                                // This usually means figure_list exists but contains an empty array
                            }
                        }

                        let imageResponseFile;
                        let imageBuffer;
                        let imageHash;

                        if (imageUri) {
                            try {
                                imageResponseFile = await fetch(imageUri);
                                imageBuffer = await imageResponseFile.buffer();
                                imageHash = hashBuffer(imageBuffer);
                                
                                // Check if the image hash already exists in the cache
                                if (cache[imageHash]) {
                                    // If the image hash exists, use the cached figure ID
                                    figureId = cache[imageHash];
                                    console.log(`Figure already in figures folder. Using file name '${cache[imageHash]}' as figure ID.`);
                                } else {
                                    console.log(`Downloading image to project's figures folder...`);
                                    
                                    // Check if an existing figure with the same URI is found in figures.yaml
                                    if (existingFigure) {
                                        // If an existing figure is found, use its ID
                                        figureId = existingFigure.id;
                                        console.log('Figure with corresponding URI found in figures.yaml. Using existing figure ID.');
                                    } else if (id1 === 'accession') {
                                        // If the object ID type is 'accession', use the accession number as the figure ID
                                        if (!accession) {
                                            throw new Error('Accession number not found.');
                                        }
                                        figureId = accession;
                                    } else {
                                        // Generate a new figure ID based on object information
                                        if (objectId) {
                                            // Construct the potential figureId
                                            const potentialFigureId = `cat-${objectId}`;
                                        
                                            // Check if the potentialFigureId already exists in figuresYaml.figure_list
                                            let idExists;
                                            try {
                                                idExists = figuresYaml.figure_list.some(figure => figure.id === potentialFigureId);
                                            } catch {
                                            }
                                        
                                            if (!idExists) {
                                                // If the ID does not exist, use it
                                                figureId = potentialFigureId;
                                            } else {
                                                console.log(`The figure ID '${potentialFigureId}' already exists. Generating figure ID based on object title instead.`);
                                                
                                                // Otherwise, generate a new ID based on object title
                                                let existingFigureIds;
                                                if (figuresYaml && figuresYaml.figure_list && Array.isArray(figuresYaml.figure_list)) {
                                                    existingFigureIds = figuresYaml.figure_list.map(fig => fig.id);
                                                }
                                                
                                                // Remove punctuation and convert spaces to hyphens
                                                let baseId = `cat-${objectTitle.toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, '-')}`;
                                                let suffix = '';
                                                if (existingFigureIds && existingFigureIds.some(id => id.startsWith(baseId))) {
                                                    let i = 1;
                                                    while (existingFigureIds.includes(`${baseId}-${String.fromCharCode(96 + i)}`)) {
                                                        i++;
                                                    }
                                                    suffix = `-${String.fromCharCode(96 + i)}`;
                                                }
                                                figureId = `${baseId}${suffix}`;
                                            }
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error(`Error fetching image for object ID ${objectId}: ${error.message}`);
                            }
                        } else {
                            console.log(`No image found for object ID ${objectId}.`);
                        }
                        metadata['figure'] = figureId;
                        const figure_metadata = {
                            id: figureId,
                            src: `figures/${figureId}.jpg`,
                            caption: `${objectTitle}.`,
                            accession: accession,
                            uri: uri
                        };

                        // Log or push object and figure metadata
                        if (options.dryRun) {
                            console.log('objects.yaml entry:');
                            console.log(metadata);
                            console.log('figures.yaml entry:')
                            console.log(figure_metadata);
                        } else {
                            objectsYaml.object_list.push(metadata);

                            // Sort objects by ID
                            objectsYaml.object_list.sort((a, b) => parseInt(a.id) - parseInt(b.id));
                            
                            try {
                                // Add figure ID to the figure field of the object
                                const objectIndex = objectsYaml.object_list.findIndex(obj => obj [config.objectFieldNames.uri] === uri);

                                if (objectIndex !== -1) {
                                    if (!Array.isArray(objectsYaml.object_list[objectIndex].figure)) {
                                        objectsYaml.object_list[objectIndex].figure = [];
                                    }
                                    objectsYaml.object_list[objectIndex].figure.push({ id: figureId });
                                } else {
                                    throw new Error(`Object with linked art URI ${uri} not found in objects.yaml.`);
                                }

                            } catch (error) {
                                console.error(`Error adding figure ID to objects.yaml for object ID ${objectId}: ${error.message}`);
                            }
                    
                            if (imageBuffer) {
                                if (!existingFigure) {
                                    figuresYaml.figure_list.push(figure_metadata);
                                    }

                                // Update the cache with the new image hash
                                cache[imageHash] = figureId;
                                fs.writeFileSync(figureCachePath, JSON.stringify(cache, null, 2));
                        
                                // Update figures.yaml
                                fs.writeFileSync('./content/_data/figures.yaml', yaml.dump(figuresYaml));
                        
                                // Save image file
                                const imagePath = `./content/_assets/images/figures/${figureId}.jpg`;
                                fs.writeFileSync(imagePath, imageBuffer);
                            }

                            // Save the modified objects back to objects.yaml
                            fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml));
                            console.log(`Linked Art added successfully. Object ID: ${objectId}. Figure ID: ${figureId}.`);
                        }
                    }
            
                    if (thing === 'object.figure') {
                        // Validate the object field names
                        validateObjectFieldNames(config);

                        // Check if object ID is provided
                        if (!id1) {
                            throw new Error(`Object ID must be provided.`);
                        }
                    
                        // Check if the object ID exists in objects.yaml
                        const objectIndex = objectsYaml.object_list.findIndex(obj => obj.id.toString() === id1.toString());
                        if (objectIndex === -1) {
                            throw new Error(`Object with ID ${id1} not found in objects.yaml.`);
                        }

                        // Handle empty figures.yaml
                        if (!figuresYaml || 
                            !figuresYaml.figure_list || 
                            figuresYaml.figure_list.length === 0 || 
                            (figuresYaml.figure_list.length === 1 && 
                                (!figuresYaml.figure_list[0] || 
                                !figuresYaml.figure_list[0].id || 
                                figuresYaml.figure_list[0].id.trim() === '' ||
                                figuresYaml.figure_list[0].id.trim() === '-'))
                        ) {

                            figuresYaml = { figure_list: [] };
                        }
                        
                        // Initialize figureId
                        let figureId;

                        // Initialize linked-art.json cache
                        let cachedData = {};

                        // Initialize variables for additional responses
                        let objectData, iiifManifestData;

                        try {
                            const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
                            cachedData = JSON.parse(cacheContent);
                        } catch (error) {
                            if (error.code !== 'ENOENT') {
                                throw error; // Rethrow the error if it is not related to file not found
                            }
                        }

                        // If the provided URI is already in cache, retrieve data from cache
                        if (uri in cachedData && !options['force']) {
                            console.log('Retrieving Linked Art from cache...');
                            objectData = cachedData[uri].objectData;
                            iiifManifestData = cachedData[uri].iiifManifestData;
                        }
                    
                        // Get objectData
                        if (!objectData) {
                            objectData = await getObjectData(linkedArtCachePath, uri, options);
                        }                                 
                    
                        iiifManifestData = await findIIIFManifest(objectData);

                        // Store fetched data in the cache file
                        cachedData[uri] = { objectData, iiifManifestData };
                        await fs.promises.writeFile(linkedArtCachePath, JSON.stringify(cachedData, null, 2), 'utf-8');

                        // Find objectTitle in objectData
                        let objectTitle;
                        objectTitle = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);

                        // Find accession in objectData
                        let accession;
                        accession = await findAccession(objectData, accessionUris);

                        // Find creditLine in objectData
                        let creditLine
                        creditLine = await findLinguisticObject(objectData, creditLineUris, 'Credit line');

                        // Check if the cache file exists
                        let cache;
                        try {
                            const cacheData = fs.readFileSync(figureCachePath, 'utf8');
                            cache = JSON.parse(cacheData);
                        } catch (error) {
                            // If cache file doesn't exist, create an empty cache object
                            cache = {};
                            fs.writeFileSync(figureCachePath, '{}'); // Create the cache file
                        }

                        // Extract image URI
                        let imageUri;
                        try {
                            imageUri = await findImageUri(iiifManifestData);
                        } catch (error) {
                            console.error(`Image URI not found in IIIF manifest.`);
                        }

                        // Ensure imageUri is defined before proceeding
                        if (imageUri && options.resize) {
                            try {
                                imageUri = await resizeImage(iiifManifestData, options, imageUri);
                            } catch (error) {
                                console.error(`Error occurred while resizing image.`);
                            }
                        }

                        // Initialize existingFigure
                        let existingFigure;

                        // Check if figure_list in figures.yaml exists and contains valid entries
                        if (figuresYaml && figuresYaml.figure_list && Array.isArray(figuresYaml.figure_list)) {
                            try {
                                // Look for figure with the given uri
                                existingFigure = figuresYaml.figure_list.find(fig => fig.uri === uri);
                            } catch {
                                // Catch and let existingFigure remain undefined if 'cannot read properties of null (reading 'uri')'
                                // This usually means figure_list exists but contains an empty array
                            }
                        }

                        let imageResponseFile;
                        let imageBuffer;
                        let imageHash;

                        if (imageUri) {
                            imageResponseFile = await fetch(imageUri);
                            imageBuffer = await imageResponseFile.buffer();
                            imageHash = hashBuffer(imageBuffer);

                            // Check if the image hash already exists in the cache
                            if (cache[imageHash]) {
                                // If the image hash exists, use the cached figure ID
                                figureId = cache[imageHash];
                                console.log(`Figure already in figures folder. Using file name '${cache[imageHash]}' as figure ID.`);
                            } else {
                                console.log(`Downloading image to project's figures folder...`);
                                
                                // Check if the figure ID is already included in the list of figures of the object
                                if (objectsYaml.object_list[objectIndex].figure.some(figure => figure.id === figureId)) {
                                    console.log("Figure already included in the object's list of figures.");
                                    return;
                                } else if (existingFigure) {
                                    // If an existing figure is found, use its ID
                                    figureId = existingFigure.id;
                                    console.log('Figure with corresponding URI found in figures.yaml. Using existing figure ID.');
                                } else if (id2 && id2 != 'accession') {
                                    // If the user provides id2, use it as the figure ID
                                    figureId = `cat-${id2}`;
                                } else if (id2 === 'accession') {
                                    // If the user enters 'accession' as id2, use the accession number as the figure ID
                                    if (!accession) {
                                        throw new Error('Accession number not found.');
                                    }
                                    figureId = `cat-${accession}`;
                                } else {
                                    // Generate figure ID with suffix if necessary
                                    let figureBaseId = `cat-${id1}`;
                                    let suffix = 'b';
                                    let existingSuffixes = figuresYaml.figure_list
                                        .filter(fig => fig.id.startsWith(figureBaseId))
                                        .map(fig => fig.id.replace(`${figureBaseId}-`, ''));
                                    while (existingSuffixes.includes(suffix)) {
                                        // If the figure ID already exists, increment the suffix alphabetically
                                        suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
                                    }
                                    figureId = `${figureBaseId}-${suffix}`;
                                }
                            }
                        }
                        // Add figure ID to the figure field of the object
                        if (!objectsYaml.object_list[objectIndex].figure) {
                            objectsYaml.object_list[objectIndex].figure = [];
                        }

                        if (!objectsYaml.object_list[objectIndex].figure.some(figure => figure.id === figureId)) {
                            objectsYaml.object_list[objectIndex].figure.push({ id: figureId });
                        }

                        const metadata = objectsYaml.object_list[objectIndex];

                        const figure_metadata = {
                            id: figureId,
                            src: `figures/${figureId}.jpg`,
                            caption: `${objectTitle}.`,
                            accession: accession,
                            uri: uri
                        }

                        // Log or push object and figure metadata
                        if (options.dryRun) {
                            console.log('objects.yaml entry:');
                            console.log(metadata);
                            console.log('figures.yaml entry:')
                            console.log(figure_metadata);
                        } else {
                            // Save image file
                            const imagePath = `./content/_assets/images/figures/${figureId}.jpg`;
                            fs.writeFileSync(imagePath, imageBuffer);

                            // Update the cache with the new image hash
                            cache[imageHash] = figureId;
                            fs.writeFileSync(figureCachePath, JSON.stringify(cache, null, 2));

                            // Add image to figures.yaml
                            if (!existingFigure) {
                                // Add image to figures.yaml
                                figuresYaml.figure_list.push(figure_metadata);
                            }

                            // Update figures.yaml
                            fs.writeFileSync('./content/_data/figures.yaml', yaml.dump(figuresYaml));

                            // Write back the updated objects.yaml file
                            fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml));
                            console.log(`Figure added to object in objects.yaml successfully. Object ID: ${id1}. Figure ID: ${figureId}.`);
                        }
                    }            

                    if (thing === 'figure') {
                        // Validate the object field names
                        validateObjectFieldNames(config);

                        // Handle empty figures.yaml
                        if (!figuresYaml || 
                            !figuresYaml.figure_list || 
                            figuresYaml.figure_list.length === 0 || 
                            (figuresYaml.figure_list.length === 1 && 
                                (!figuresYaml.figure_list[0] || 
                                !figuresYaml.figure_list[0].id || 
                                figuresYaml.figure_list[0].id.trim() === '' ||
                                figuresYaml.figure_list[0].id.trim() === '-'))
                        ) {
                            figuresYaml = { figure_list: [] };
                        }

                        // Initialize figureId
                        let figureId;

                        // Initialize linked-art.json cache
                        let cachedData = {};

                        // Initialize variables for additional responses
                        let objectData, iiifManifestData;

                        try {
                            const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
                            cachedData = JSON.parse(cacheContent);
                        } catch (error) {
                            if (error.code !== 'ENOENT') {
                                throw error; // Rethrow the error if it is not related to file not found
                            }
                        }

                        // If the provided URI is already in cache, retrieve data from cache
                        if (uri in cachedData && !options['force']) {
                            console.log('Retrieving Linked Art from cache...');
                            objectData = cachedData[uri].objectData;
                            iiifManifestData = cachedData[uri].iiifManifestData;
                        }

                        // Get objectData
                        if (!objectData) {
                            objectData = await getObjectData(linkedArtCachePath, uri, options);
                        }                                 

                        iiifManifestData = await findIIIFManifest(objectData);

                        // Store fetched data in the cache file
                        cachedData[uri] = { objectData, iiifManifestData };
                        await fs.promises.writeFile(linkedArtCachePath, JSON.stringify(cachedData, null, 2), 'utf-8');

                        // Find objectTitle in objectData
                        let objectTitle;
                        objectTitle = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);

                        // Find accession in objectData
                        let accession;
                        accession = await findAccession(objectData, accessionUris);

                        // Find creditLine in objectData
                        let creditLine
                        creditLine = await findLinguisticObject(objectData, creditLineUris, 'Credit line');

                        // Check if the cache file exists
                        let cache;
                        try {
                            const cacheData = fs.readFileSync(figureCachePath, 'utf8');
                            cache = JSON.parse(cacheData);
                        } catch (error) {
                            // If cache file doesn't exist, create an empty cache object
                            cache = {};
                            fs.writeFileSync(figureCachePath, '{}'); // Create the cache file
                        }

                        // Extract image URI
                        let imageUri;
                        try {
                            imageUri = await findImageUri(iiifManifestData);
                        } catch (error) {
                            console.error(`Image URI not found in IIIF manifest.`);
                        }

                        // Ensure imageUri is defined before proceeding
                        if (imageUri && options.resize) {
                            try {
                                imageUri = await resizeImage(iiifManifestData, options, imageUri);
                            } catch (error) {
                                console.error(`Error occurred while resizing image.`);
                            }
                        }

                        // Initialize existingFigure
                        let existingFigure;

                        // Check if figure_list in figures.yaml exists and contains valid entries
                        if (figuresYaml && figuresYaml.figure_list && Array.isArray(figuresYaml.figure_list)) {
                            try {
                                // Look for figure with the given uri
                                existingFigure = figuresYaml.figure_list.find(fig => fig.uri === uri);
                            } catch {
                                // Catch and let existingFigure remain undefined if 'cannot read properties of null (reading 'uri')'
                                // This usually means figure_list exists but contains an empty array
                            }
                        }

                        let imageResponseFile;
                        let imageBuffer;
                        let imageHash;

                        if (imageUri) {
                            imageResponseFile = await fetch(imageUri);
                            imageBuffer = await imageResponseFile.buffer();
                            imageHash = hashBuffer(imageBuffer);
                            
                            // Check if the image hash already exists in the cache
                            if (cache[imageHash]) {
                                // If the image hash exists, use the cached figure ID
                                figureId = cache[imageHash];
                                console.log(`Figure already in figures folder. Using file name '${cache[imageHash]}' as figure ID.`);
                            } else {
                                console.log(`Downloading image to project's figures folder...`);
                                
                                // Generate a new figure ID
                                if (id1 === 'accession') {
                                    if (!accession) {
                                        throw new Error('Accession number not found.');
                                    }
                                    figureId = accession;
                                } else if (!id1) {
                                    // Calculate the next available figure ID
                                    const existingIds = figuresYaml.figure_list.map(fig => fig.id);
                                    let maxId = 0;
                                    for (const id of existingIds) {
                                        const numericId = parseInt(id);
                                        if (!isNaN(numericId) && numericId > maxId) {
                                            maxId = numericId;
                                        }
                                    }
                                    figureId = maxId + 1;
                                } else {
                                    if (figuresYaml.figure_list.some(fig => fig.id.toString() === id1.toString())) {
                                        console.log(`A record with the id ${id1} already exists.`);
                                        return;
                                    }
                                    figureId = id1;
                                }
                            }
                        }

                        const figure_metadata = {
                            id: figureId.toString(),
                            src: `figures/${figureId}.jpg`,
                            caption: `${objectTitle}.`,
                            accession: accession,
                            uri: uri
                        }

                        // Log or push object and figure metadata
                        if (options.dryRun) {
                            console.log('figures.yaml entry:')
                            console.log(figure_metadata);
                        } else {
                            // Save image file
                            const imagePath = `./content/_assets/images/figures/${figureId}.jpg`;
                            fs.writeFileSync(imagePath, imageBuffer);

                            // Update the cache with the new image hash
                            cache[imageHash] = figureId;
                            fs.writeFileSync(figureCachePath, JSON.stringify(cache, null, 2));

                            // Add image to figures.yaml
                            if (!existingFigure) {
                                // Add image to figures.yaml
                                figuresYaml.figure_list.push(figure_metadata);
                            }

                            // Update figures.yaml
                            fs.writeFileSync('./content/_data/figures.yaml', yaml.dump(figuresYaml));
                            console.log(`Figure added to figures.yaml successfully. Figure ID: ${figureId}.`);
                        }
                    }                 
                    
                    if (thing === 'spreadsheet') {
                        // Get objectData
                        const objectData = await getObjectData(linkedArtCachePath, uri, options);

                        // Find objectTitle in objectData
                        let fileName = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
                        if (fileName) {
                            fileName = fileName
                                .toLowerCase()                   // Convert to lowercase
                                .replace(/\s+/g, '_')            // Replace whitespace with underscores
                                .replace(/[^\w\s-]/g, '')        // Remove non-word characters except whitespace and hyphens
                                .replace(/^-+/g, '')             // Trim leading hyphens
                                .replace(/-+$/g, '');            // Trim trailing hyphens
                        } else {
                            console.log('Failed to fetch object title.');
                        }

                        // Check if spreadsheet for the object has already been created
                        const filePath = path.join(process.cwd(), `${fileName}_data.csv`);
                        fs.access(filePath, fs.constants.F_OK, (err) => {
                            if (err) {
                              if (err.code === 'ENOENT') {
                                // Spreadsheet does not already exist. Proceeding.
                              }
                            } else {
                              console.log(`${filePath} already exists`);
                              process.exit(1);
                            }
                          });

                        // Function to flatten the JSON-LD object into key-value pairs
                        async function flattenJsonLd(jsonLd) {
                            const flattened = {};

                            // Helper function to recursively flatten objects
                            function flatten(obj, prefix = '') {
                                for (const key in obj) {
                                    if (typeof obj[key] === 'object') {
                                        flatten(obj[key], `${prefix}${key}_`);
                                    } else {
                                        flattened[`${prefix}${key}`] = obj[key];
                                    }
                                }
                            }

                            flatten(jsonLd);
                            return flattened;
                        }

                        // Call the function to flatten the JSON-LD
                        const flattenedData = await flattenJsonLd(objectData);

                        // Convert flattened data to CSV format
                        let csvContent = 'Field,Content\n'; // Header line

                        // Generate CSV rows with key and value columns
                        for (const key in flattenedData) {
                            let value = flattenedData[key].toString();
                            if (value.startsWith('http')) {
                                try {
                                    const valueData = await fetchData(value);
                                    const valueTitle = findPrimaryName(valueData, primaryNameUris);
                                    value = valueTitle ? valueTitle : value;
                                } catch (error) {
                                    continue;
                                }
                            }
                            value = value.includes(',') ? `"${value}"` : value; // Enclose value in quotes if it contains a comma
                            csvContent += `${key},${value}\n`;
                        }

                        // Find objectTitle in objectData
                        (async () => {             
                            // Write CSV content to a file
                            fs.writeFileSync(`${fileName}_data.csv`, csvContent, 'utf8');
                            console.log('CSV file generated successfully.');
                        })();

                        const valueDataType = objectData['type']

                        // Mapping of data types to documentation URLs
                        const documentationUrls = {
                            HumanMadeObject: 'https://linked.art/api/1.0/endpoint/physical_object/',
                            DigitalObject: 'https://linked.art/api/1.0/endpoint/digital_object/',
                            Activity: 'https://linked.art/api/1.0/endpoint/event/',
                            // Add more data types and their documentation URLs as needed
                        };

                        // Function to get documentation URL based on data type
                        function getDocumentationUrl(dataType) {
                            return documentationUrls[dataType] || 'Documentation link not available for this data type.';
                        }

                        // Provide link to documentation
                        const documentationLink = getDocumentationUrl(valueDataType);
                        console.log(`For help interpreting the fields, see Linked Art documentation for ${valueDataType} here: ${documentationLink}`);
                    }
                }
            }
        } catch (error) {
            if (error.code === 'ENOTFOUND') {
                console.error(`Failed to fetch Linked Art. Could not resolve hostname. Please check your network connection and try again.`);
            } else {
                console.log(`Failed to fetch Linked Art. ${error.message}`);
            }
        }
    }
}