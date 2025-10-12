export function polishEntity(entity: string) {
    // every first letter of a word should be capitalized and any extra spaces should be removed
    entity = entity.trim();
    entity = entity.toLowerCase();
    return entity.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}