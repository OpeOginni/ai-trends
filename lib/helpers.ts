export function polishEntity(entity: string) {
    // Trim and clean the entity
    entity = entity.trim();
    
    // Remove common markdown/formatting artifacts
    entity = entity.replace(/^["'`]+|["'`]+$/g, '');
    entity = entity.replace(/^\*+|\*+$/g, '');
    
    // If it contains explanatory text (em dash, because, colon, etc), extract just the entity part
    const dashMatch = entity.match(/^([^—–-]+)(?:—|–|-)/);
    if (dashMatch) {
        entity = dashMatch[1].trim();
    }
    
    const becauseMatch = entity.match(/^([^,]+)(?:,?\s+because|,?\s+since|,?\s+as it)/i);
    if (becauseMatch) {
        entity = becauseMatch[1].trim();
    }
    
    const colonMatch = entity.match(/^([^:]+):/);
    if (colonMatch) {
        entity = colonMatch[1].trim();
    }
    
    // Remove extra quotes and punctuation again after extraction
    entity = entity.replace(/^["'`]+|["'`]+$/g, '');
    entity = entity.replace(/[.!?]+$/, '');
    
    // Limit to reasonable length (first 64 chars if too long)
    if (entity.length > 64) {
        entity = entity.substring(0, 64).trim();
    }
    
    // Capitalize first letter of each word
    entity = entity.toLowerCase();
    return entity.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}