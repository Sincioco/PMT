# IIS Setup

These steps assume the app is deployed to an internal Windows Server with IIS and SQL Server 2019 access.

## 1. Prepare SQL Server

Open SQL Server Management Studio or `sqlcmd` and run the scripts in this order:

```text
Sql\01_CreateDatabase.sql
Sql\02_CreateStoredProcedures.sql
Sql\03_SeedData.sql
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

## 3. Publish the App

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

## 4. IIS Without SSL

1. Install the ASP.NET Core Hosting Bundle for .NET 6 on the IIS server.
2. Open IIS Manager.
3. Create a new Application Pool named `PMT`.
4. Set `.NET CLR version` to `No Managed Code`.
5. Create a new Web Site named `PMT`.
6. Set the physical path to the published folder, such as `D:\Sites\PMT`.
7. Bind the site to HTTP port `80` or another internal port.
8. Grant the application pool identity read/write permission to:
   - the published folder
   - `wwwroot\uploads`
9. Browse to the site.

Default login:

```text
User: Sin
Password: Password1
```

## 5. IIS With SSL

1. Complete the non-SSL setup first.
2. Import or create a server certificate in IIS.
3. Open the PMT site in IIS Manager.
4. Click `Bindings`.
5. Add an `https` binding on port `443`.
6. Select the certificate.
7. Keep the HTTP binding if internal users still need it, or remove it if HTTPS-only is required.
8. Browse to `https://your-server-name/`.

For internal development servers, a self-signed certificate can work, but each client machine must trust it to avoid browser warnings.

## 6. File Uploads

Uploaded files are stored under:

```text
wwwroot\uploads
```

Back up this folder with the SQL Server database.

## 7. Updating PMT

1. Stop the IIS site or app pool.
2. Back up the current published folder and database.
3. Copy the new published files over the old files.
4. Run any new SQL scripts.
5. Start the IIS site or app pool.
