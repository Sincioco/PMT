# IIS Setup

These steps assume the app is deployed to an internal Windows Server with IIS and SQL Server 2019 access.

## 1. Prepare SQL Server

Open SQL Server Management Studio or `sqlcmd` and run the scripts in this order:

```text
Sql\01_CreateDatabase.sql
Sql\02_CreateStoredProcedures.sql
Sql\03_SeedData.sql
Sql\03_SeedData_PMT.sql
Sql\03_SeedData_LMS.sql
Sql\03_SeedData_HLS.sql
```

Every table, function, and stored procedure is under the `[pmt]` schema.

## 2. Configure the Connection String

Edit `appsettings.json` in the deployed folder.

Example using Windows authentication:

```json
{
  "ConnectionStrings": {
    "PmtDatabase": "Server=YOUR-SQL-SERVER;Database=PMT;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True"
  }
}
```

Example using SQL authentication:

```json
{
  "ConnectionStrings": {
    "PmtDatabase": "Server=YOUR-SQL-SERVER;Database=PMT;User Id=pmt_user;Password=CHANGE_ME;TrustServerCertificate=True;MultipleActiveResultSets=True"
  }
}
```

## 3. Configure Root or Sub-Application URL

PMT can run from the domain root, a first-level path, or a deeper IIS Application path. Set `Deployment:PathBase` in the deployed `appsettings.json` to match the public URL path before PMT.

For PMT as the root web site, such as `http://domain/`, keep the path base blank:

```json
"Deployment": {
  "PathBase": ""
}
```

For PMT under a first-level path, such as `http://domain/pmt/`, set:

```json
"Deployment": {
  "PathBase": "/pmt"
}
```

For PMT as a nested IIS Application, such as `http://domain/mainurl/pmt/`, set:

```json
"Deployment": {
  "PathBase": "/mainurl/pmt"
}
```

The same setting is used by the ASP.NET Core middleware and by the browser shell. CSS, JavaScript, built-in images, API calls, uploaded files, and stored internal `/assets` or `/uploads` URLs are resolved under the configured path base at runtime. `UploadStorage:RequestPath` should stay as `/uploads`; externally it is served under the path base, for example `/pmt/uploads/...`.

## 4. Publish the App

On a build machine with the .NET 6 SDK available:

```powershell
dotnet restore
dotnet publish -c Release -o .\publish
```

Copy the contents of the `publish` folder to the IIS server, for example:

```text
D:\Sites\PMT
```

For a locked-down server, restore and publish on a machine that has package access, then transfer only the published folder.

## 5. IIS Without SSL

1. Install the ASP.NET Core Hosting Bundle for .NET 6 on the IIS server.
2. Open IIS Manager.
3. Create a new Application Pool named `PMT`.
4. Set `.NET CLR version` to `No Managed Code`.
5. Create a new Web Site named `PMT`.
6. Set the physical path to the published folder, such as `D:\Sites\PMT`.
7. Bind the site to HTTP port `80` or another internal port.
8. Grant the application pool identity read/write permission to:
   - the published folder
   - the configured `UploadStorage:RootPath` folder when no fileshare credentials are supplied
9. Browse to the site.

Default login:

```text
User: Sin
Password: Password1
```

## 6. IIS With SSL

1. Complete the non-SSL setup first.
2. Import or create a server certificate in IIS.
3. Open the PMT site in IIS Manager.
4. Click `Bindings`.
5. Add an `https` binding on port `443`.
6. Select the certificate.
7. Keep the HTTP binding if internal users still need it, or remove it if HTTPS-only is required.
8. Browse to `https://your-server-name/`.

For internal development servers, a self-signed certificate can work, but each client machine must trust it to avoid browser warnings.

## 7. File Uploads

Uploaded files are stored under the configured `UploadStorage:RootPath`. The default local setting is:

```json
"UploadStorage": {
  "RootPath": "C:\\PMT\\UploadedFiles",
  "RequestPath": "/uploads",
  "UserName": "",
  "Password": ""
}
```

When `UserName` and `Password` are blank, PMT uses `RootPath` as-is and the IIS application pool identity must have read/write access to that folder.

For a Windows fileshare, set `RootPath` to the UNC folder and provide the fileshare account:

```json
"UploadStorage": {
  "RootPath": "\\\\fileserver\\share\\folder",
  "RequestPath": "/uploads",
  "UserName": "DOMAIN\\pmt-files",
  "Password": "CHANGE_ME"
}
```

When both credentials are supplied, PMT connects to the UNC share at startup and uses that connection for uploads and `/uploads` downloads. Back up the configured upload folder with the SQL Server database.

If PMT encounters a configuration or file-system access error while initializing the upload folder, it logs the detailed storage error and continues running without upload storage. A persistent warning appears on the Login screen and throughout PMT. Upload requests and `/uploads` file requests return an unavailable response, but database-backed screens remain usable. PMT never silently falls back to another folder. Correct `RootPath`, credentials, or application-pool permissions, then restart the PMT application so the upload provider and any UNC connection can be established again.

## 8. Updating PMT

1. Build and publish the new release into a separate, empty folder. Keep its application files and migration scripts from the same Git commit.
2. Record the current database version and production configuration, including the connection string, path base, and upload-storage settings.
3. Stop the IIS site or application pool and keep it stopped throughout the database migration and application replacement.
4. Back up and verify the database, then preserve the current published folder, production configuration, and complete upload folder as one matched rollback set.
5. Run the exact forward migrations for the installed database version. Verify the version marker, table counts, SQL contract, and database integrity before continuing.
6. Deploy the matching published application without overwriting BDO's production configuration or upload storage.
7. Start the IIS site or application pool and perform the release's production-safe smoke test.
8. Press Ctrl+F5 once in the browser to bypass cached frontend assets.
9. Keep the release SHA, backup verification, migration logs, pre/post data manifest, and smoke-test record together. Roll back the application, database, configuration, and uploads as one set if validation fails.

For the July 15, 2026 BDO deployment to the current Version 1.15 release, use `Sql/Migrations/2026-07-15 - PMT - BDO Migration Scripts.html` as the authoritative self-contained runbook. It packages, hashes, runs, and verifies all five forward migrations from the Version 1.10 BDO baseline through Version 1.15.
