// Script to list all files that need to be updated to use JWT auth instead of Next-Auth
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// List of directories to scan
const apiDirs = [
  'src/app/api/live-streams/[id]',
  'src/app/api/live-streams/[id]/rewards',
  'src/app/api/live-streams/[id]/moderation',
  'src/app/api/live-streams/[id]/share',
  'src/app/api/live-streams/[id]/highlights',
  'src/app/api/live-streams/[id]/analytics',
  'src/app/api/live-streams/[id]/listings',
  'src/app/api/live-streams/[id]/chat',
];

// Find all route.ts files in these directories
const findRouteFiles = () => {
  const routeFiles = [];
  
  apiDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const routeFile = path.join(dir, 'route.ts');
      if (fs.existsSync(routeFile)) {
        routeFiles.push(routeFile);
      }
      
      // Check subdirectories
      const subdirs = fs.readdirSync(dir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => path.join(dir, dirent.name));
        
      subdirs.forEach(subdir => {
        const subRouteFile = path.join(subdir, 'route.ts');
        if (fs.existsSync(subRouteFile)) {
          routeFiles.push(subRouteFile);
        }
      });
    }
  });
  
  return routeFiles;
};

// Check if a file still uses getServerSession from next-auth
const checkUsesNextAuth = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('getServerSession') || 
         content.includes('from \'next-auth\'') || 
         content.includes('authOptions');
};

// Main function
const main = () => {
  console.log('Files that need to be updated to use JWT authentication:');
  const routeFiles = findRouteFiles();
  const filesToUpdate = routeFiles.filter(checkUsesNextAuth);
  
  filesToUpdate.forEach(file => {
    console.log(file);
  });
  
  console.log(`\nTotal files to update: ${filesToUpdate.length}`);
};

main(); 