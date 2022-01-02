const { logInfo, logError, bumpVersion, analyseVersionChange, getCurrentVersion, getNewProjectContent } = require('../src/utils');
describe('Utils', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('logInfo', () => {
    test('should log correct message', () => {
      const spy = jest.spyOn(global.console, 'info').mockImplementation(() => { return; });
      const message = 'message';
      logInfo(message);
      expect(spy).toHaveBeenNthCalledWith(1, message);
    });
  });
  describe('logError', () => {
    test('should log correct message', () => {
      const spy = jest.spyOn(global.console, 'error').mockImplementation(() => { return; });
      const message = 'message';
      logError(message);
      expect(spy).toHaveBeenNthCalledWith(1, `✖  fatal     ${message}`);
    });
  });
  describe('bumpVersion', () => {
    test('should bump major version', () => {
      const newVersion = bumpVersion('0.0.0', true, false, false, false, undefined);
      expect(newVersion).toEqual('1.0.0');
    });
    test('should bump minor version', () => {
      const newVersion = bumpVersion('0.0.0', false, true, false, false, undefined);
      expect(newVersion).toEqual('0.1.0');
    });
    test('should bump fix version', () => {
      const newVersion = bumpVersion('0.0.0', false, false, true, false, undefined);
      expect(newVersion).toEqual('0.0.1');
    });
    test('should bump prerelease version', () => {
      const newVersion = bumpVersion('0.0.0', false, false, false, true, 'pre');
      expect(newVersion).toEqual('0.0.1-pre.0');
    });
    test('should bump existing prerelease version', () => {
      const newVersion = bumpVersion('0.0.1-pre.0', false, false, false, true, 'pre');
      expect(newVersion).toEqual('0.0.1-pre.1');
    });
    test('should bump existing prerelease version to new prerelease id', () => {
      const newVersion = bumpVersion('0.0.1-pre.0', false, false, false, true, 'pre2');
      expect(newVersion).toEqual('0.0.1-pre2.0');
    });
  });
  describe('analyseVersionChange', () => {
    test('figure out to bump major version', () => {
      const {doMajorVersion, doMinorVersion, doPatchVersion, doPreReleaseVersion} = analyseVersionChange('feat!', '', '', '', ['feat!: change request']);
      expect(doMajorVersion).toEqual(true);
      expect(doMinorVersion).toEqual(false);
      expect(doPatchVersion).toEqual(false);
      expect(doPreReleaseVersion).toEqual(false);
    });
    test('figure out to bump minor version', () => {
      const {doMajorVersion, doMinorVersion, doPatchVersion, doPreReleaseVersion} = analyseVersionChange('feat!', 'feat', '', '', ['feat: change request']);
      expect(doMajorVersion).toEqual(false);
      expect(doMinorVersion).toEqual(true);
      expect(doPatchVersion).toEqual(false);
      expect(doPreReleaseVersion).toEqual(false);
    });
    test('figure out to bump patch version', () => {
      const {doMajorVersion, doMinorVersion, doPatchVersion, doPreReleaseVersion} = analyseVersionChange('feat!', 'feat', 'fix', '', ['fix: change request']);
      expect(doMajorVersion).toEqual(false);
      expect(doMinorVersion).toEqual(false);
      expect(doPatchVersion).toEqual(true);
      expect(doPreReleaseVersion).toEqual(false);
    });
    test('figure out to bump pre-release version', () => {
      const {doMajorVersion, doMinorVersion, doPatchVersion, doPreReleaseVersion} = analyseVersionChange('feat!', 'feat', 'fix', 'pre', ['pre: change request']);
      expect(doMajorVersion).toEqual(false);
      expect(doMinorVersion).toEqual(false);
      expect(doPatchVersion).toEqual(false);
      expect(doPreReleaseVersion).toEqual(true);
    });
  });
  describe('getCurrentVersion', () => {
    test('should return version', () => {
      const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netcoreapp3.1</TargetFramework>
    <RootNamespace>Asyncapi.Nats.Client</RootNamespace>
    <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
    <Version>1.0.0</Version>
  </PropertyGroup>

  <ItemGroup>
    <None Remove="NATS.Client"/>
    <None Remove="System.Text.Json"/>
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="NATS.Client" Version="0.12.0"/>
    <PackageReference Include="System.Text.Json" Version="5.0.2"/>
  </ItemGroup>
</Project>
`;
      const version = getCurrentVersion(csproj);
      expect(version).toEqual('1.0.0');
    });
    test('should return undefined when no version present', () => {
      const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netcoreapp3.1</TargetFramework>
    <RootNamespace>Asyncapi.Nats.Client</RootNamespace>
    <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
  </PropertyGroup>

  <ItemGroup>
    <None Remove="NATS.Client"/>
    <None Remove="System.Text.Json"/>
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="NATS.Client" Version="0.12.0"/>
    <PackageReference Include="System.Text.Json" Version="5.0.2"/>
  </ItemGroup>
</Project>
`;
      const version = getCurrentVersion(csproj);
      expect(version).toBeUndefined();
    });
  });
  
  describe('getNewProjectContent', () => {
    test('should return version', () => {
      const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netcoreapp3.1</TargetFramework>
    <RootNamespace>Asyncapi.Nats.Client</RootNamespace>
    <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
    <Version>1.0.0</Version>
  </PropertyGroup>

  <ItemGroup>
    <None Remove="NATS.Client"/>
    <None Remove="System.Text.Json"/>
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="NATS.Client" Version="0.12.0"/>
    <PackageReference Include="System.Text.Json" Version="5.0.2"/>
  </ItemGroup>
</Project>`;
      const content = getNewProjectContent('1.0.1', csproj);
      expect(content).toEqual(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netcoreapp3.1</TargetFramework>
    <RootNamespace>Asyncapi.Nats.Client</RootNamespace>
    <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
    <Version>1.0.1</Version>
  </PropertyGroup>

  <ItemGroup>
    <None Remove="NATS.Client"/>
    <None Remove="System.Text.Json"/>
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="NATS.Client" Version="0.12.0"/>
    <PackageReference Include="System.Text.Json" Version="5.0.2"/>
  </ItemGroup>
</Project>`);
    });
    test('should return correctly when no version present', () => {
      const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netcoreapp3.1</TargetFramework>
    <RootNamespace>Asyncapi.Nats.Client</RootNamespace>
    <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
  </PropertyGroup>

  <ItemGroup>
    <None Remove="NATS.Client"/>
    <None Remove="System.Text.Json"/>
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="NATS.Client" Version="0.12.0"/>
    <PackageReference Include="System.Text.Json" Version="5.0.2"/>
  </ItemGroup>
</Project>
`;
      const content = getNewProjectContent('1.0.1', csproj);
      expect(content).toEqual(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netcoreapp3.1</TargetFramework>
    <RootNamespace>Asyncapi.Nats.Client</RootNamespace>
    <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
  <Version>1.0.1</Version></PropertyGroup>

  <ItemGroup>
    <None Remove="NATS.Client"/>
    <None Remove="System.Text.Json"/>
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="NATS.Client" Version="0.12.0"/>
    <PackageReference Include="System.Text.Json" Version="5.0.2"/>
  </ItemGroup>
</Project>`);
    });
  });
});