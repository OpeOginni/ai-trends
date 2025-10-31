export function polishEntity(entity: string) {
    // Trim and clean the entity
    entity = entity.trim();
    
    // Handle JSON object strings (e.g., {"entity":"Name"})
    try {
        const parsed = JSON.parse(entity);
        if (parsed && typeof parsed === 'object' && 'entity' in parsed) {
            entity = String(parsed.entity).trim();
        }
    } catch {
        // Not JSON, continue with regular cleaning
    }
    
    // Remove citation markers (e.g., citeturn0search0, citeturn0news12turn0search1, cite1, etc.)
    entity = entity.replace(/cite(?:turn\d+)?(?:news\d+)?(?:turn\d+)?(?:search)?\d*/gi, '');
    
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
    
    // Trim again after all cleaning
    entity = entity.trim();
    
    // Limit to reasonable length (first 64 chars if too long)
    if (entity.length > 64) {
        entity = entity.substring(0, 64).trim();
    }
    
    // Capitalize first letter of each word
    entity = entity.toLowerCase();
    return entity.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}