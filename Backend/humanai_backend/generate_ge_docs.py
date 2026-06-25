import asyncio
import os
import shutil
import uuid
import pandas as pd
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.employee import Employee
from app.models.user import User

async def load_database_data():
    """Loads database tables into Pandas DataFrames using async SQLAlchemy sessions."""
    async with AsyncSessionLocal() as session:
        # Load employees
        res_emp = await session.execute(select(Employee))
        employees = res_emp.scalars().all()
        emp_list = []
        for e in employees:
            emp_list.append({
                "id": str(e.id),
                "tenant_id": e.tenant_id,
                "full_name": e.full_name,
                "matricule": e.matricule,
                "hire_date": str(e.hire_date) if e.hire_date else None,
                "contract_type": e.contract_type.value if hasattr(e.contract_type, "value") else str(e.contract_type)
            })
        df_emp = pd.DataFrame(emp_list)
        if df_emp.empty:
            # Fallback mock for testing/init
            df_emp = pd.DataFrame([{
                "id": str(uuid.uuid4()),
                "tenant_id": "default-tenant",
                "full_name": "Mock Employee",
                "matricule": "EMP999",
                "hire_date": "2026-01-01",
                "contract_type": "cdi"
            }])
            
        # Load users
        res_usr = await session.execute(select(User))
        users = res_usr.scalars().all()
        usr_list = []
        for u in users:
            usr_list.append({
                "id": str(u.id),
                "tenant_id": u.tenant_id,
                "email": u.email,
                "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            })
        df_usr = pd.DataFrame(usr_list)
        if df_usr.empty:
            df_usr = pd.DataFrame([{
                "id": str(uuid.uuid4()),
                "tenant_id": "default-tenant",
                "email": "mock@humanai.com",
                "role": "collaborateur"
            }])
            
        return df_emp, df_usr

async def main():
    print("==> Loading data from PostgreSQL...")
    df_emp, df_usr = await load_database_data()
    print(f"    Loaded {len(df_emp)} employees and {len(df_usr)} users.")

    print("==> Initializing Great Expectations FileDataContext...")
    # Initialize a GX local folder structure
    import great_expectations as gx
    
    ge_root = "/app/great_expectations"
    if os.path.exists(ge_root):
        shutil.rmtree(ge_root)
        
    context = gx.get_context(
        context_root_dir=ge_root
    )
    
    # 1. Create Expectation Suites
    print("==> Creating expectation suites...")
    suite_emp = context.suites.add(gx.ExpectationSuite(name="employees_suite"))
    suite_emp.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="id"))
    suite_emp.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="full_name"))
    suite_emp.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="matricule"))
    suite_emp.add_expectation(gx.expectations.ExpectColumnValuesToBeInSet(
        column="contract_type",
        value_set=["cdi", "cdd", "stage", "freelance"]
    ))

    suite_usr = context.suites.add(gx.ExpectationSuite(name="users_suite"))
    suite_usr.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="id"))
    suite_usr.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="email"))
    suite_usr.add_expectation(gx.expectations.ExpectColumnValuesToBeInSet(
        column="role",
        value_set=["collaborateur", "manager", "rh", "direction", "admin", "qvt", "superadmin", "super_admin"]
    ))

    # 2. Add Datasource and Assets
    datasource = context.data_sources.add_pandas(name="huma_pandas_datasource")
    
    asset_emp = datasource.add_dataframe_asset(name="employees_asset")
    batch_def_emp = asset_emp.add_batch_definition_whole_dataframe("employees_batch_def")

    asset_usr = datasource.add_dataframe_asset(name="users_asset")
    batch_def_usr = asset_usr.add_batch_definition_whole_dataframe("users_batch_def")

    # 3. Create Validation Definitions
    # Get classes dynamically to handle GX 1.x exports flexibly
    ValidationDefinition = getattr(gx, "ValidationDefinition", None)
    if ValidationDefinition is None:
        from great_expectations.core.validation_definition import ValidationDefinition

    CheckpointClass = getattr(gx, "Checkpoint", None)
    if CheckpointClass is None:
        from great_expectations.checkpoint.checkpoint import Checkpoint as CheckpointClass

    validation_def_emp = context.validation_definitions.add(
        ValidationDefinition(
            name="validation_def_emp",
            data=batch_def_emp,
            suite=suite_emp
        )
    )

    validation_def_usr = context.validation_definitions.add(
        ValidationDefinition(
            name="validation_def_usr",
            data=batch_def_usr,
            suite=suite_usr
        )
    )

    # 4. Create Checkpoints and Run
    print("==> Running data validation checkpoints...")
    checkpoint_emp = context.checkpoints.add(
        CheckpointClass(
            name="checkpoint_emp",
            validation_definitions=[validation_def_emp]
        )
    )
    checkpoint_emp.run(batch_parameters={"dataframe": df_emp})

    checkpoint_usr = context.checkpoints.add(
        CheckpointClass(
            name="checkpoint_usr",
            validation_definitions=[validation_def_usr]
        )
    )
    checkpoint_usr.run(batch_parameters={"dataframe": df_usr})

    # 5. Build Data Docs
    print("==> Compiling Great Expectations Data Docs...")
    context.build_data_docs()
    
    # 6. Copy generated Data Docs to /app/docs/great_expectations
    src_docs_dir = os.path.join(ge_root, "uncommitted", "data_docs", "local_site")
    dest_docs_dir = "/app/docs/great_expectations"
    
    if os.path.exists(dest_docs_dir):
        shutil.rmtree(dest_docs_dir)
        
    shutil.copytree(src_docs_dir, dest_docs_dir)
    print(f"    ✓ Data Docs compiled and copied successfully to {dest_docs_dir}")
    
    # Clean up GE root directory in python to avoid cluttering unless needed
    # (keeping it is nice to show configuration files, but uncommitted folder can be ignored)
    
if __name__ == "__main__":
    asyncio.run(main())
